/**
 * Google Custom Search — cari review/ulasan produk dari internet
 *
 * Gratis: 100 query/hari
 * Docs: https://developers.google.com/custom-search/v1/overview
 */

export interface GoogleSearchResult {
  title: string;
  snippet: string;
  link: string;
}

const CSE_ID = process.env.GOOGLE_CSE_ID || '';
const API_KEY = process.env.GOOGLE_CSE_API_KEY || '';
const API_BASE = 'https://www.googleapis.com/customsearch/v1';

/**
 * Cari review/ulasan untuk suatu produk
 *
 * @param productName - Nama produk untuk dicari
 * @param maxResults - Maksimal hasil (default 3)
 * @returns Array of search result snippets
 */
export async function searchProductReviews(productName: string, maxResults: number = 3): Promise<GoogleSearchResult[]> {
  if (!CSE_ID || !API_KEY) {
    console.warn('[Google Search] CSE_ID atau API_KEY tidak diset');
    return [];
  }

  // Query yang relevan untuk cari review
  const queries = [
    `"${productName}" review OR ulasan OR testimoni`,
    `"${productName}" harga review`,
  ];

  const allResults: GoogleSearchResult[] = [];

  for (const query of queries) {
    try {
      const url = new URL(API_BASE);
      url.searchParams.set('cx', CSE_ID);
      url.searchParams.set('key', API_KEY);
      url.searchParams.set('q', query);
      url.searchParams.set('lr', 'lang_id'); // Prioritaskan bahasa Indonesia
      url.searchParams.set('num', String(maxResults));
      url.searchParams.set('safe', 'active');

      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[Google Search] HTTP ${response.status} untuk "${query}"`);
        continue;
      }

      const data = await response.json();

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          allResults.push({
            title: item.title || '',
            snippet: item.snippet || '',
            link: item.link || '',
          });
        }
      }

      // Batasi total hasil
      if (allResults.length >= maxResults) break;
    } catch (error) {
      console.error(`[Google Search] Gagal search "${query}":`, error);
    }
  }

  return allResults.slice(0, maxResults);
}