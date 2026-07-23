/**
 * Browserless scraper — untuk scraping halaman JS-rendered (Shopee, dll)
 * Menggunakan Browserless /scrape API: https://docs.browserless.io/scrape
 *
 * Fallback setelah metode HTML biasa gagal.
 */

export interface BrowserlessScrapedData {
  title: string;
  description: string;
  imageUrl: string;
  price?: string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  siteName: string;
}

const BROWSERLESS_API_BASE = 'https://production-sfo.browserless.io';
const TIMEOUT_MS = 7500;

/**
 * Scrape halaman via Browserless /scrape endpoint
 * Menggunakan structured selectors — langsung dapat data terstruktur, bukan HTML mentah
 */
export async function scrapeWithBrowserless(url: string): Promise<BrowserlessScrapedData | null> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    console.warn('[Browserless] BROWSERLESS_API_KEY tidak diset');
    return null;
  }

  const endpoint = `${BROWSERLESS_API_BASE}/scrape?token=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'networkidle2', timeout: 8000 },
        elements: [
          { selector: '[data-sqe="name"], .product-title, h1, .pdp-product-title' },
          { selector: '[class*="price"], .product-price, .pdp-product-price' },
          { selector: 'img[class*="product"], img[class*="pdp"], .product-image img' },
        ],
      }),
    });

    clearTimeout(timeout);

    console.log(`[Browserless] HTTP status: ${response.status} ${response.statusText}`);

    const rawText = await response.text();
    console.log('[Browserless] RAW response:', rawText);

    if (!response.ok) {
      console.error(`[Browserless] HTTP ${response.status}:`, rawText.slice(0, 300));
      return null;
    }

    try {
      const result = JSON.parse(rawText);
      console.log('[Browserless] ✅ Parsed JSON:', JSON.stringify(result).slice(0, 300));
      return parseBrowserlessScrapeResult(result, new URL(url).hostname);
    } catch {
      console.error('[Browserless] Response bukan JSON valid');
      return null;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[Browserless] Timeout setelah ${TIMEOUT_MS}ms`);
    } else {
      console.error('[Browserless] Fetch error:', error);
    }
    return null;
  }
}

/**
 * Scrape halaman via Browserless /content endpoint — dapat HTML mentah
 * Berguna untuk debug dan parsing manual jika /scrape gagal
 */
export async function scrapeWithBrowserlessContent(url: string): Promise<string | null> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    console.warn('[BrowserlessContent] BROWSERLESS_API_KEY tidak diset');
    return null;
  }

  const endpoint = `${BROWSERLESS_API_BASE}/content?token=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'networkidle2', timeout: Math.min(TIMEOUT_MS, 7000) },
      }),
    });

    clearTimeout(timeout);

    console.log(`[BrowserlessContent] HTTP status: ${response.status} ${response.statusText}`);
    console.log(`[BrowserlessContent] content-type: ${response.headers.get('content-type')}`);

    const html = await response.text();
    console.log(`[BrowserlessContent] HTML length: ${html.length}`);
    console.log(`[BrowserlessContent] snippet: ${html.slice(0, 2000)}`);

    if (!response.ok) {
      console.error(`[BrowserlessContent] HTTP ${response.status}: ${html.slice(0, 300)}`);
      return null;
    }

    return html;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[BrowserlessContent] Timeout setelah ${TIMEOUT_MS}ms`);
    } else {
      console.error('[BrowserlessContent] Fetch error:', error);
    }
    return null;
  }
}

/**
 * Parse hasil JSON dari /scrape endpoint
 * Response format: { data: [{ results: [{ text: string } | { attribute: string }] }] }
 * Setiap elements[i] → data[i].results
 */
export function parseBrowserlessScrapeResult(result: any, hostname: string): BrowserlessScrapedData | null {
  if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
    console.warn('[Browserless] Empty scrape response');
    return null;
  }

  const getText = (index: number): string => {
    const item = result.data[index];
    if (!item || !item.results || !Array.isArray(item.results) || item.results.length === 0) return '';
    return item.results[0].text || '';
  };

  const getAttribute = (index: number, attrName: string): string => {
    const item = result.data[index];
    if (!item || !item.results || !Array.isArray(item.results) || item.results.length === 0) return '';
    const attrs = item.results[0].attributes;
    if (!Array.isArray(attrs)) return '';
    const found = attrs.find((a: any) => a.name === attrName);
    return found?.value || '';
  };

  const title = getText(0);
  const priceText = getText(1);
  const imageUrl = getAttribute(2, 'src');

  if (!title) {
    console.warn('[Browserless] Tidak ada data title ditemukan');
    return null;
  }

  // Parse harga dari teks
  let price: string | undefined;
  const pricePatterns = [
    /Rp\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]+)?)/,
    /Rp\s*([0-9]+(?:\,[0-9]{3})*(?:\.[0-9]+)?)/,
    /IDR\s*([0-9]+(?:\.[0-9]{3})*)/i,
  ];
  if (priceText) {
    for (const pattern of pricePatterns) {
      const match = priceText.match(pattern);
      if (match) {
        const num = parseFloat(match[1].replace(/\./g, '').replace(/,/g, '.'));
        if (num > 0) {
          price = num.toLocaleString('id-ID');
          break;
        }
      }
    }
  }

  return {
    title,
    description: title,
    imageUrl,
    price,
    currency: priceText ? 'IDR' : undefined,
    siteName: hostname,
  };
}