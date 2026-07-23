/**
 * Product meta scraper — fetch Open Graph tags + JSON-LD + regex harga dari URL produk
 * Digunakan untuk auto-fill data produk affiliate.
 *
 * Sumber data:
 * 1. Open Graph tags (og:title, og:description, og:image)
 * 2. JSON-LD (Schema.org Product) — harga, rating, review count
 * 3. Regex harga dari teks HTML (fallback jika JSON-LD tidak ada)
 * 4. Nama produk dari URL path (fallback jika halaman diblok)
 *
 * Timeout: 5 detik
 * User-agent: random rotation
 */

export interface ScrapedProduct {
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  price?: string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

function getMetaContent(html: string, property: string): string {
  const regex = new RegExp(`<meta\\s+[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  const nameRegex = new RegExp(`<meta\\s+[^>]*name=["']${property.replace('og:', '')}["'][^>]*content=["']([^"']*)["']`, 'i');
  const nameMatch = html.match(nameRegex);
  if (nameMatch) return nameMatch[1];
  return '';
}

function getTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Parse JSON-LD dari halaman untuk data produk
 */
function parseJsonLd(html: string): { price?: string; currency?: string; rating?: number; reviewCount?: number; description?: string } {
  const result: { price?: string; currency?: string; rating?: number; reviewCount?: number; description?: string } = {};

  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());

      const product = data['@type'] === 'Product' ? data :
                      Array.isArray(data['@graph']) ? data['@graph'].find((item: any) => item['@type'] === 'Product') :
                      data.mainEntity?.product || data.mainEntity;

      if (product && product['@type'] === 'Product') {
        if (product.name && !result.description) result.description = product.name;
        if (product.description && !result.description) result.description = product.description;

        const offers = product.offers;
        if (offers) {
          const price = Array.isArray(offers) ? offers[0] : offers;
          if (price.price) result.price = String(price.price);
          if (price.priceCurrency) result.currency = price.priceCurrency;
        }

        const aggRating = product.aggregateRating;
        if (aggRating) {
          if (aggRating.ratingValue) result.rating = parseFloat(aggRating.ratingValue);
          if (aggRating.reviewCount) result.reviewCount = parseInt(aggRating.reviewCount, 10);
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return result;
}

/**
 * Regex harga dari teks HTML (fallback)
 */
function extractPriceFromHtml(html: string): string | undefined {
  const patterns = [
    /Rp\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]+)?)/g,
    /Rp\s*([0-9]+(?:\,[0-9]{3})*(?:\.[0-9]+)?)/g,
    /IDR\s*([0-9]+(?:\.[0-9]{3})*)/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    if (matches.length > 0) {
      const prices = matches.map(m => parseFloat(m[1].replace(/\./g, '').replace(/,/g, '.')));
      const maxPrice = Math.max(...prices);
      if (maxPrice > 0) return maxPrice.toLocaleString('id-ID');
    }
  }

  return undefined;
}

/**
 * Ekstrak nama produk dari URL path
 * Contoh: /SSD-EYOTA-128GB-SATA-III-... → "SSD EYOTA 128GB SATA III"
 * Contoh: /product/nama-produk-123 → "nama produk"
 */
function extractProductNameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);

    // Cari bagian path terpanjang yang bukan angka/id
    for (const part of pathParts) {
      // Skip jika hanya angka atau terlalu pendek
      if (part.length < 10 || /^\d+$/.test(part)) continue;
      // Skip jika mengandung query params
      if (part.includes('?')) continue;

      // Bersihkan: ganti dash/hyphen dengan spasi, hapus angka id di akhir
      let name = part
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Hapus trailing angka (biasanya ID produk)
      name = name.replace(/\s+\d+$/, '');

      // Hanya return jika cukup panjang untuk jadi nama produk
      if (name.length > 15) return name;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Extract shopid dan itemid dari URL Shopee
 * Pola: shopee.co.id/{slug}/{shopid}/{itemid}
 */
function extractShopeeIds(url: string): { shopid?: string; itemid?: string } | undefined {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);
    // Cari 2 angka terakhir di path
    const numbers: string[] = [];
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(pathParts[i])) {
        numbers.push(pathParts[i]);
      }
      if (numbers.length >= 2) break;
    }
    if (numbers.length >= 2) {
      // Shopee URL: /{slug}/{shopid}/{itemid}
      // Setelah resolve redirect, biasanya pattern: /product/{shopid}/{itemid}
      return {
        shopid: numbers[1],
        itemid: numbers[0],
      };
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Fetch data produk dari Shopee internal API
 */
async function fetchShopeeItem(url: string): Promise<ScrapedProduct | null> {
  const ids = extractShopeeIds(url);
  if (!ids || !ids.shopid || !ids.itemid) {
    return null;
  }

  const apiUrl = `https://shopee.co.id/api/v4/item/get?itemid=${ids.itemid}&shopid=${ids.shopid}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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
      console.warn(`[Scraper][ShopeeAPI] HTTP ${response.status} untuk ${apiUrl}`);
      return null;
    }

    const body = await response.text();
    
    // Cek apakah JSON valid
    try {
      const json = JSON.parse(body);
      if (json.error) {
        console.warn('[Scraper][ShopeeAPI] Error:', json.error);
        return null;
      }
      
      const data = json.data;
      if (!data) {
        console.warn('[Scraper][ShopeeAPI] No data field');
        return null;
      }

      // Map Shopee API response ke ScrapedProduct
      const title = data.name || '';
      const description = data.description || title;
      const imageUrl = data.image || data.images?.[0] || '';
      const price = data.price ? String(data.price) : undefined;
      const currency = data.currency || 'IDR';
      const rating = data.item_rating?.rating_star ? data.item_rating.rating_star : undefined;
      const reviewCount = data.item_rating?.rating_count || undefined;

      if (!title && !description) {
        return null;
      }

      return {
        title,
        description,
        imageUrl,
        siteName: 'shopee.co.id',
        price,
        currency,
        rating,
        reviewCount,
      };
    } catch {
      console.warn('[Scraper][ShopeeAPI] Response is not valid JSON');
      return null;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[Scraper][ShopeeAPI] Timeout: ${apiUrl}`);
    } else {
      console.error('[Scraper][ShopeeAPI] Fetch failed:', error);
    }
    return null;
  }
}

/**
 * Scrape product info from URL
 */
export async function scrapeProductMeta(url: string, timeoutMs: number = 5000): Promise<ScrapedProduct | null> {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Scraper] ⛔ Blocked oleh server — HTTP ${response.status} untuk ${url}`);
      // Coba extract nama dari URL sebagai fallback
      const urlName = extractProductNameFromUrl(url);
      if (urlName) {
        return {
          title: urlName,
          description: urlName,
          imageUrl: '',
          siteName: new URL(url).hostname,
        };
      }
      return null;
    }

    const html = await response.text();

    // Parse URL untuk hostname check
    const parsedUrl = new URL(url);

    // DEBUG LOG — temporary
    console.debug('[Scraper] DEBUG:', {
      url,
      status: response.status,
      htmlLength: html.length,
      snippet: html.slice(0, 500),
    });

    // Untuk Shopee, coba internal API terlebih dahulu
    let scrapedProduct: ScrapedProduct | null = null;
    if (parsedUrl.hostname.includes('shopee.co.id')) {
      scrapedProduct = await fetchShopeeItem(url);
    }

    // Cek apakah response benar-benar HTML (bukan JSON error page)
    if (!html.trim().startsWith('<') && !html.trim().startsWith('<!')) {
      console.warn(`[Scraper] ⚠️ Response bukan HTML (mungkin block) untuk ${url}`);
      const urlName = extractProductNameFromUrl(url);
      if (urlName) {
        return {
          title: urlName,
          description: urlName,
          imageUrl: '',
          siteName: new URL(url).hostname,
        };
      }
      return null;
    }

    // 1. Open Graph
    const title = getMetaContent(html, 'og:title') || getTitle(html);
    const description = getMetaContent(html, 'og:description') || getMetaContent(html, 'description');
    const imageUrl = getMetaContent(html, 'og:image');
    const siteName = getMetaContent(html, 'og:site_name') || new URL(url).hostname;

    // 2. JSON-LD
    const ld = parseJsonLd(html);

    // 3. Regex harga (fallback)
    const price = ld.price || extractPriceFromHtml(html);

    if (!title && !description) {
      console.warn(`[Scraper] ❌ Tidak ada meta tag ditemukan di ${url}`);
      // Fallback: extract dari URL path
      const urlName = extractProductNameFromUrl(url);
      if (urlName) {
        return {
          title: urlName,
          description: urlName,
          imageUrl: '',
          siteName: new URL(url).hostname,
        };
      }
      return null;
    }

    return {
      title,
      description: ld.description || description,
      imageUrl,
      siteName,
      price,
      currency: ld.currency || 'IDR',
      rating: ld.rating,
      reviewCount: ld.reviewCount,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[Scraper] ⏱ Timeout setelah ${timeoutMs}ms: ${url}`);
    } else {
      console.error(`[Scraper] 💥 Gagal scrape ${url}:`, error);
    }
    // Fallback: extract dari URL
    const urlName = extractProductNameFromUrl(url);
    if (urlName) {
      return {
        title: urlName,
        description: urlName,
        imageUrl: '',
        siteName: new URL(url).hostname,
      };
    }
    return null;
  }
}