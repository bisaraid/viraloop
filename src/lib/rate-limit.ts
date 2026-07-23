/**
 * Rate limiter menggunakan Upstash Redis (sliding window)
 *
 * Untuk Vercel serverless: Redis diperlukan karena in-memory tidak reliable
 * (tiap request bisa beda instance server).
 *
 * ⚠️ Fail-open strategy:
 * Jika koneksi Redis gagal/timeout, error di-log dan request DIIZINKAN lewat.
 * Trade-off: availability > security saat Redis down.
 * Alternatif fail-closed bisa diaktifkan dengan mengganti fallback di catch block.
 *
 * Interface checkRateLimit(key, maxRequests, windowMs) tetap SAMA
 * seperti implementasi in-memory sebelumnya — tidak ada breaking change
 * di pemanggil (generate-script/route.ts dan generate-tts/route.ts).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Inisialisasi Redis client dari env vars
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let redisClient: Redis | null = null;
let redisAvailable = false;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    redisAvailable = true;
  } catch (err) {
    console.error('⚠️ [RateLimit] Gagal inisialisasi Redis:', err);
  }
} else {
  console.warn('⚠️ [RateLimit] UPSTASH_REDIS_REST_URL/TOKEN tidak diset — Redis tidak tersedia');
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Fallback in-memory store jika Redis tidak tersedia
 */
const fallbackStore = new Map<string, { timestamps: number[] }>();

// Cleanup expired fallback entries setiap 60 detik
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < 60_000);
    if (entry.timestamps.length === 0) {
      fallbackStore.delete(key);
    }
  }
}, 60_000);

function fallbackCheck(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let entry = fallbackStore.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    fallbackStore.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);
  const currentCount = entry.timestamps.length;
  const allowed = currentCount < maxRequests;

  if (allowed) {
    entry.timestamps.push(now);
  }

  const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
  const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

  return {
    allowed,
    remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
    resetInSeconds,
  };
}

/**
 * Check rate limit untuk suatu key identifier
 *
 * @param key - Unique identifier (misal: "layer1:127.0.0.1" atau "layer2:127.0.0.1:same-origin")
 * @param maxRequests - Maksimum request dalam sliding window
 * @param windowMs - Window time dalam ms (default: 60_000 = 1 menit)
 *
 * @returns RateLimitResult dengan allowed, remaining, resetInSeconds
 *
 * Catatan: Signature function ini SAMA dengan implementasi in-memory sebelumnya.
 * Tidak ada perubahan cara panggil di generate-script/route.ts dan generate-tts/route.ts.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  // Jika Redis tidak tersedia, gunakan fallback in-memory
  if (!redisAvailable || !redisClient) {
    return fallbackCheck(key, maxRequests, windowMs);
  }

  try {
    // Buat ratelimit instance per-call (stateless)
    const ratelimit = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
      prefix: 'viraloop-ratelimit',
      analytics: false,
    });

    const { success, remaining, reset } = await ratelimit.limit(key);

    return {
      allowed: success,
      remaining,
      resetInSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    // Fail-open: jika Redis error, log dan allow request
    console.error(`⚠️ [RateLimit] Redis error untuk key "${key}":`, error);
    return fallbackCheck(key, maxRequests, windowMs);
  }
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}