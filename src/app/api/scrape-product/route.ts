import { NextRequest, NextResponse } from 'next/server';
import { scrapeProductMeta } from '@/lib/scraper/meta-scraper';
import { searchProductReviews } from '@/lib/scraper/google-search';

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

export async function POST(request: NextRequest) {
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

    // Step 1: Scrape meta + JSON-LD dari URL (timeout 5 detik)
    const scraped = await scrapeProductMeta(url);

    // Step 2: Jika scrape gagal, coba Google CSE dengan keyword dari URL
    if (!scraped) {
      const keyword = extractSearchKeyword(url);
      if (keyword) {
        console.log(`[Scraper] 🔍 Fallback ke Google Search untuk: "${keyword}"`);
        const searchResults = await searchProductReviews(keyword, 3);
        const snippets = searchResults.map(r => r.snippet).filter(s => s && s.length > 0);

        if (snippets.length > 0) {
          const partialResult: ScrapeProductResult = {
            title: keyword,
            description: snippets[0],
            imageUrl: '',
            siteName: parsedUrl.hostname,
            reviewSnippets: snippets,
          };
          return NextResponse.json({ success: true, data: partialResult });
        }
      }

      // Step 3: Google CSE juga gagal — return partial dengan nama dari URL path saja
      const urlName = extractSearchKeyword(url);
      if (urlName) {
        return NextResponse.json({
          success: true,
          data: {
            title: urlName,
            description: urlName,
            imageUrl: '',
            siteName: parsedUrl.hostname,
          } as ScrapeProductResult,
        });
      }

      // Step 4: Semua gagal — return data kosong tapi success tetap true
      return NextResponse.json({
        success: true,
        data: {
          title: 'Produk dari ' + parsedUrl.hostname,
          description: '',
          imageUrl: '',
          siteName: parsedUrl.hostname,
        } as ScrapeProductResult,
      });
    }

    // Step 5: Scrape sukses — cari review dari internet via Google CSE
    const productName = scraped.title || scraped.description || '';
    let reviewSnippets: string[] = [];
    if (productName) {
      const searchResults = await searchProductReviews(productName, 3);
      reviewSnippets = searchResults
        .map(r => r.snippet)
        .filter(s => s && s.length > 0);
    }

    // Step 6: Gabung semua
    const result: ScrapeProductResult = {
      title: scraped.title,
      description: scraped.description,
      imageUrl: scraped.imageUrl,
      siteName: scraped.siteName,
      price: scraped.price,
      currency: scraped.currency,
      rating: scraped.rating,
      reviewCount: scraped.reviewCount,
      reviewSnippets: reviewSnippets.length > 0 ? reviewSnippets : undefined,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Scrape product error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat mengambil data produk' },
      { status: 500 }
    );
  }
}