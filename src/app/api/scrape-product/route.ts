import { NextRequest, NextResponse } from 'next/server';
import { scrapeProductMeta } from '@/lib/scraper/meta-scraper';
import { scrapeWithBrowserless } from '@/lib/scraper-browser';
import { searchProductReviews } from '@/lib/scraper/google-search';
import dns from 'node:dns';
import { promisify } from 'node:util';

const lookup = promisify(dns.lookup);

export interface ScrapeProductResult {
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  price?: string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  reviewSnippets?: string[];
}

/**
 * Ekstrak keyword dari URL path untuk fallback Google Search
 */
function extractSearchKeyword(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);

    for (const part of pathParts) {
      if (part.length < 10 || /^\d+$/.test(part)) continue;
      const name = part
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+\d+$/, '')
        .trim();
      if (name.length > 15) return name;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Cek apakah IP adalah private/internal
 */
function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

/**
 * Whitelist domain yang boleh di-resolve
 */
const ALLOWED_DOMAINS = new Set([
  's.id',
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'vt.tiktok.com',
  'shp.ee',
  'shopee.co.id',
  'tiktok.com',
  'tokopedia.com',
]);

function isAllowedDomain(hostname: string): boolean {
  if (ALLOWED_DOMAINS.has(hostname)) return true;
  for (const domain of ALLOWED_DOMAINS) {
    if (hostname.endsWith('.' + domain)) return true;
  }
  return false;
}

/**
 * Resolve redirect dengan SSRF protection
 * - Manual redirect loop (max 5 hop)
 * - Whitelist domain check setiap hop
 * - Private IP check setiap hop
 * - Timeout 1.5 detik per request
 */
async function resolveRedirectSafe(url: string): Promise<string> {
  const MAX_HOPS = 5;
  const TIMEOUT_MS = 1500;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return url;
    }

    if (!isAllowedDomain(parsedUrl.hostname)) {
      return url;
    }

    try {
      const { address } = await lookup(parsedUrl.hostname, { all: false });
      if (isPrivateIp(address)) {
        console.warn(`[Scraper] Blocked private IP redirect: ${parsedUrl.hostname} -> ${address}`);
        return url;
      }
    } catch (err) {
      console.warn(`[Scraper] DNS lookup failed for ${parsedUrl.hostname}:`, err);
      return url;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      clearTimeout(timeoutId);

      if (!response.status || response.status < 300 || response.status >= 400) {
        return url;
      }

      const location = response.headers.get('location');
      if (!location) {
        return url;
      }

      try {
        url = new URL(location, url).toString();
      } catch {
        return url;
      }
    } catch (err) {
      console.warn(`[Scraper] Fetch failed for ${url}:`, err);
      return url;
    }
  }

  console.warn(`[Scraper] Max redirect hops exceeded for ${url}`);
  return url;
}

/**
 * Extract shopid dan itemid dari URL Shopee
 * Pola: shopee.co.id/{slug}/{shopid}/{itemid}
 */
function extractShopeeIds(url: string): { shopid?: string; itemid?: string } | undefined {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);
    const numbers: string[] = [];
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(pathParts[i])) {
        numbers.push(pathParts[i]);
      }
      if (numbers.length >= 2) break;
    }
    if (numbers.length >= 2) {
      return { shopid: numbers[1], itemid: numbers[0] };
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Fetch Shopee internal API dengan timeout 1.5 detik
 */
async function fetchShopeeItem(url: string): Promise<ScrapeProductResult | null> {
  const ids = extractShopeeIds(url);
  if (!ids || !ids.shopid || !ids.itemid) return null;

  const apiUrl = `https://shopee.co.id/api/v4/item/get?itemid=${ids.itemid}&shopid=${ids.shopid}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://shopee.co.id/',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[ShopeeAPI] HTTP ${response.status} untuk ${apiUrl}`);
      return null;
    }

    const body = await response.text();
    const json = JSON.parse(body);
    if (json.error || !json.data) {
      console.warn('[ShopeeAPI] Error or no data:', json.error);
      return null;
    }

    const data = json.data;
    const title = data.name || '';
    if (!title) return null;

    return {
      title,
      description: data.description || title,
      imageUrl: data.image || data.images?.[0] || '',
      siteName: 'shopee.co.id',
      price: data.price ? String(data.price) : undefined,
      currency: data.currency || 'IDR',
      rating: data.item_rating?.rating_star || undefined,
      reviewCount: data.item_rating?.rating_count || undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[ShopeeAPI] Timeout: ${apiUrl}`);
    } else {
      console.error('[ShopeeAPI] Fetch error:', error);
    }
    return null;
  }
}

/**
 * Buat partial result dari nama URL path
 */
function makePartialResult(name: string, hostname: string): ScrapeProductResult {
  return { title: name, description: name, imageUrl: '', siteName: hostname };
}

// Simple in-memory logging for success rate (in production, use proper logging/DB)
const scrapeStats = { html: 0, shopee: 0, browserless: 0, fallback: 0, total: 0 };

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Field url wajib diisi' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'URL tidak valid' }, { status: 400 });
    }

    const allowedDomains = ['tokopedia.com', 'shopee.co.id', 'tiktok.com', 'tiktokcdn.com'];
    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Hanya mendukung URL Tokopedia, Shopee, dan TikTok' },
        { status: 400 }
      );
    }

    // Step 0: Resolve short link (max 1.5s)
    const resolvedUrl = await resolveRedirectSafe(url);
    const hostname = new URL(resolvedUrl).hostname || parsedUrl.hostname;
    const keyword = extractSearchKeyword(resolvedUrl);

    // Step 1: HTML scrape cepat saja (skip Shopee API — sudah 403)
    const htmlData = await scrapeProductMeta(resolvedUrl, 1200);

    if (htmlData) {
      scrapeStats.html++;
      console.log(`[Scraper] ✅ HTML scrape sukses (${Date.now() - startTime}ms)`);
      const productName = htmlData.title || htmlData.description || '';
      let reviewSnippets: string[] = [];
      if (productName) {
        const searchResults = await searchProductReviews(productName, 3);
        reviewSnippets = searchResults.map(r => r.snippet).filter(s => s && s.length > 0);
      }
      return NextResponse.json({
        success: true,
        data: { ...htmlData, reviewSnippets: reviewSnippets.length > 0 ? reviewSnippets : undefined },
      });
    }

    // Step 2: Coba Google Search fallback (dari keyword)
    if (keyword) {
      console.log(`[Scraper] 🔍 Google Search fallback: "${keyword}"`);
      const searchResults = await searchProductReviews(keyword, 3);
      const snippets = searchResults.map(r => r.snippet).filter(s => s && s.length > 0);
      if (snippets.length > 0) {
        return NextResponse.json({
          success: true,
          data: { title: keyword, description: snippets[0], imageUrl: '', siteName: hostname, reviewSnippets: snippets },
        });
      }
    }

    // Step 3: Browserless fallback (max 5s)
    console.log(`[Scraper] 🌐 Fallback ke Browserless (${Date.now() - startTime}ms)`);
    const browserData = await scrapeWithBrowserless(resolvedUrl);
    if (browserData) {
      scrapeStats.browserless++;
      console.log(`[Scraper] ✅ Browserless sukses (${Date.now() - startTime}ms)`);
      return NextResponse.json({ success: true, data: browserData });
    }

    // Step 4: Semua gagal — debug dengan /content lalu return failure
    console.log(`[Scraper] ❌ Semua metode gagal (${Date.now() - startTime}ms)`);
    scrapeStats.fallback++;
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal mengambil data produk otomatis. Silakan isi manual.',
        data: null
      },
      { status: 422 }
    );
  } catch (error) {
    console.error('Scrape product error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil data produk' },
      { status: 500 }
    );
  } finally {
    scrapeStats.total++;
    console.log(`[Scraper] 📊 Stats:`, JSON.stringify(scrapeStats));
  }
}
