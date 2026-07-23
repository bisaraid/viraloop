import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getClientIp } from '../rate-limit';

// Tracking mock calls per key untuk simulasi rate limit di Redis path
const mockCalls = new Map<string, number>();

function resetMockCalls() {
  mockCalls.clear();
}

// Mock Redis — jangan throw saat konstruksi
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

// Mock Ratelimit dengan slidingWindow sebagai static method
// limit() akan track calls per key dan block setelah 5 panggilan (default)
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation(async (key: string) => {
        const count = (mockCalls.get(key) || 0) + 1;
        mockCalls.set(key, count);
        const allowed = count <= 5;
        return {
          success: allowed,
          remaining: Math.max(0, 5 - count),
          reset: Date.now() + 60000,
        };
      }),
    })),
    {
      slidingWindow: vi.fn().mockReturnValue({}),
    }
  ),
}));

// Set env vars untuk Redis path test
beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  resetMockCalls();
});

// ========================================================================
// PATH 1: Redis tersedia — test jalur Redis asli
// ========================================================================
describe('checkRateLimit — Redis path', () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    resetMockCalls();
  });

  it('should allow first request via Redis', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('redis-ip-1', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(4);
  });

  it('should block after maxRequests via Redis', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'redis-ip-2';
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(ip, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    const result = await checkRateLimit(ip, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should have independent counters via Redis untuk IP berbeda', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    await checkRateLimit('redis-ip-3', 5, 60_000);
    await checkRateLimit('redis-ip-3', 5, 60_000);
    const r1 = await checkRateLimit('redis-ip-3', 5, 60_000);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit('redis-ip-4', 5, 60_000);
    expect(r2.remaining).toBe(4);
  });

  it('should have resetInSeconds via Redis', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('redis-ip-5', 5, 60_000);
    expect(result.resetInSeconds).toBeGreaterThanOrEqual(1);
  });
});

// ========================================================================
// PATH 2: Redis tidak tersedia — test fallback in-memory
// ========================================================================
describe('checkRateLimit — fallback in-memory path', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetMockCalls();
  });

  it('should allow first request via fallback', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('fb-ip-1', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block after maxRequests via fallback', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'fb-ip-2';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(ip, 5, 60_000);
    }
    const result = await checkRateLimit(ip, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should have independent counters via fallback untuk IP berbeda', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    await checkRateLimit('fb-ip-3', 5, 60_000);
    await checkRateLimit('fb-ip-3', 5, 60_000);
    const r1 = await checkRateLimit('fb-ip-3', 5, 60_000);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit('fb-ip-4', 5, 60_000);
    expect(r2.remaining).toBe(4);
  });

  it('should have resetInSeconds via fallback', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('fb-ip-5', 5, 60_000);
    expect(result.resetInSeconds).toBeGreaterThanOrEqual(1);
  });
});

// ========================================================================
// Two-layer rate limit — test independent counters layer1 vs layer2
// ========================================================================
describe('checkRateLimit — two-layer independent counters (Redis path)', () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    resetMockCalls();
  });

  it('layer1 and layer2 have different counters for same IP via Redis', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'layer-test-1';

    // Exhaust layer1 (5 calls per key in mock)
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(`layer1:${ip}`, 10, 60_000);
    }
    expect((await checkRateLimit(`layer1:${ip}`, 10, 60_000)).allowed).toBe(false);

    // Layer2 should still be fresh (different key)
    const r = await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('layer2 same-origin vs apikey have independent counters via Redis', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'layer-test-2';

    for (let i = 0; i < 5; i++) {
      await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000);
    }
    expect((await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000)).allowed).toBe(false);

    const r = await checkRateLimit(`layer2:${ip}:apikey`, 10, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
});

describe('checkRateLimit — two-layer independent counters (fallback path)', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetMockCalls();
  });

  it('layer1 and layer2 have different counters for same IP via fallback', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'fb-layer-test-1';

    for (let i = 0; i < 10; i++) {
      await checkRateLimit(`layer1:${ip}`, 10, 60_000);
    }
    expect((await checkRateLimit(`layer1:${ip}`, 10, 60_000)).allowed).toBe(false);

    const r = await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('layer2 same-origin vs apikey have independent counters via fallback', async () => {
    const { checkRateLimit } = await import('../rate-limit');
    const ip = 'fb-layer-test-2';

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000);
    }
    expect((await checkRateLimit(`layer2:${ip}:same-origin`, 3, 60_000)).allowed).toBe(false);

    const r = await checkRateLimit(`layer2:${ip}:apikey`, 10, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });
});

// ========================================================================
// getClientIp — synchronous, import langsung di atas
// ========================================================================
describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    });
    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.5' },
    });
    expect(getClientIp(request)).toBe('10.0.0.5');
  });

  it('should return 127.0.0.1 fallback when no headers', () => {
    const request = new Request('http://localhost');
    expect(getClientIp(request)).toBe('127.0.0.1');
  });
});