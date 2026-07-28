/**
 * TrendTracker Client — Ambil data produk trending ASLI dari TrendTracker API
 * untuk digunakan sebagai konteks di prompt Affiliate.
 *
 * Panggilan API antar 2 project TERPISAH (bukan share database langsung).
 * Kalau TrendTracker API down/timeout, fallback ke mode lama (tanpa data eksternal).
 */
import { getOptionalEnvVar } from '@/lib/env';

export interface TrendingProduct {
  id: string | number;
  name: string;
  category?: string;
  description?: string;
  price?: string;
  rating?: number;
  commission_score?: number;
  trend_growth_score?: number;
  image_url?: string;
  url?: string;
}

interface TrendingApiResponse {
  success: boolean;
  data: TrendingProduct[];
  error?: string;
}

const TRENDTRACKER_API_URL = getOptionalEnvVar('TRENDTRACKER_API_URL', 'https://trendtrackerid.vercel.app');
const FETCH_TIMEOUT_MS = 5000; // 5 detik timeout — jangan blokir lama

/**
 * Fetch dengan timeout — AbortController bawaan Node 16+
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ambil daftar produk trending dari TrendTracker.
 * Fallback: return [] kalau API down/timeout/error.
 */
export async function fetchTrendingProducts(): Promise<TrendingProduct[]> {
  const baseUrl = TRENDTRACKER_API_URL || 'https://trendtrackerid.vercel.app';
  const url = `${baseUrl}/api/products/trending`;

  try {
    console.log(`[TrendTracker] Fetching trending products from ${url}`);
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.warn(`[TrendTracker] API returned status ${response.status}: ${response.statusText}`);
      return [];
    }

    const json: TrendingApiResponse = await response.json();

    if (!json.success || !Array.isArray(json.data)) {
      console.warn('[TrendTracker] API response format unexpected:', json);
      return [];
    }

    console.log(`[TrendTracker] Got ${json.data.length} trending products`);
    return json.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[TrendTracker] Request timed out — falling back to no external data');
    } else {
      console.warn('[TrendTracker] Fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return []; // Graceful fallback
  }
}

/**
 * Ambil 1 produk trending yang cocok dengan keyword/kategori user.
 * Kalau tidak cocok, ambil random dari top N.
 *
 * @param keyword - Kata kunci untuk match (opsional). Contoh: "smartphone", "skincare"
 * @returns TrendingProduct | null — null kalau API gagal atau data kosong
 */
export async function fetchTrendingProduct(keyword?: string): Promise<TrendingProduct | null> {
  const products = await fetchTrendingProducts();

  if (products.length === 0) {
    return null;
  }

  // Kalau ada keyword, coba cari yang match
  if (keyword && keyword.trim().length > 0) {
    const lowerKeyword = keyword.toLowerCase();

    // Cari exact match dulu di name
    const exactMatch = products.find(p =>
      p.name.toLowerCase().includes(lowerKeyword)
    );
    if (exactMatch) return exactMatch;

    // Cari match di category/description
    const fuzzyMatch = products.find(p =>
      (p.category && p.category.toLowerCase().includes(lowerKeyword)) ||
      (p.description && p.description.toLowerCase().includes(lowerKeyword))
    );
    if (fuzzyMatch) return fuzzyMatch;
  }

  // Fallback: random dari top 5 (atau semua kalau < 5)
  const topN = Math.min(products.length, 5);
  const randomIndex = Math.floor(Math.random() * topN);
  return products[randomIndex];
}