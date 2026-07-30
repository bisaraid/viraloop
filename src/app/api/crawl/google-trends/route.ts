/**
 * Google Trends Crawler — API Route
 *
 * Mengambil trending data dari Google Trends untuk setiap keyword per kategori.
 * Data disimpan ke tabel trend_signals dengan source='google_trends'.
 *
 * DUAL ENDPOINT (satu file route, dua method HTTP):
 *   POST /api/crawl/google-trends?category=xxx
 *     → Manual trigger / testing (curl, Postman)
 *     → Auth: Bearer API_SECRET_KEY
 *
 *   GET /api/crawl/google-trends?category=xxx
 *     → Vercel Cron Jobs (otomatis terjadwal)
 *     → Auth: Bearer CRON_SECRET
 *
 * STRATEGI:
 *   Google Trends Daily RSS Feed (public XML intended for feed readers):
 *   → https://trends.google.com/trends/trendingsearches/daily/rss?geo=ID
 *   Parse XML tanpa library, hitung relevance score keyword.
 *
 *   Fallback: Jika gagal, return signal_value = null (graceful).
 *   TIDAK PERNAH throw/crash.
 *
 * Jadwal cron (vercel.json):
 *   ?all=true jam 07:00 UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service';

// ============================================================
// KEYWORD MAPPING PER KATEGORI
// ============================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  horror: [
    'cerita horor indonesia',
    'urban legend indonesia',
    'kisah mistis nyata',
    'pengalaman horor nyata',
  ],
  psikologi: [
    'fakta psikologi menarik',
    'psikologi kepribadian',
    'mind blowing psychology facts',
    'fakta unik psikologi',
  ],
  romance: [
    'cerita cinta sedih',
    'kisah romantis mengharukan',
    'love story indonesia',
    'cerita cinta baper',
  ],
  motivasi: [
    'kata kata motivasi hidup',
    'semangat hidup sukses',
    'motivasi diri inspirasi',
    'quotes motivasi kerja',
  ],
  edukasi: [
    'fakta unik dunia',
    'pengetahuan umum menarik',
    'edukasi sains seru',
    'fakta mengejutkan sains',
  ],
  misteri: [
    'misteri belum terpecahkan',
    'teori konspirasi indonesia',
    'fenomena aneh dunia',
    'misteri sejarah yang belum terungkap',
  ],
  sejarah: [
    'fakta sejarah tersembunyi',
    'misteri sejarah dunia',
    'sejarah indonesia yang jarang diketahui',
    'peristiwa sejarah unik',
  ],
  keuangan: [
    'tips keuangan pribadi',
    'investasi untuk pemula',
    'cara mengatur keuangan',
    'edukasi finansial dasar',
  ],
};

// ============================================================
// RSS FEED PARSER (simple, no external library)
// ============================================================

interface FetchResult {
  score: number | null;
  error?: string;
}

/**
 * Fetch Google Trends Daily RSS Feed untuk Indonesia.
 * RSS Feed ini adalah public XML yang memang didesain untuk konsumsi publik.
 * 
 * Endpoint: https://trends.google.com/trends/trendingsearches/daily/rss?geo=ID
 */
async function fetchTrendingKeywords(): Promise<FetchResult & { trendingKeywords?: string[] }> {
  try {
    const url = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=ID';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ViraLoopBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      return { score: null, error: `HTTP ${response.status} dari RSS feed` };
    }

    const xml = await response.text();

    // Parse <title> tags inside <item> tags
    const titles: string[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[1];
      const titleMatch = itemContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        titles.push(titleMatch[1].trim());
      }
    }

    if (titles.length === 0) {
      // Fallback: coba parse dari root-level <title> (minus channel title)
      const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title[^>]*>([^<]+)<\/title>/i);
      const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim().toLowerCase() : '';

      const allTitles: string[] = [];
      const titleRegex = /<title[^>]*>([^<]+)<\/title>/gi;
      let tMatch;
      while ((tMatch = titleRegex.exec(xml)) !== null) {
        const t = tMatch[1].trim();
        if (t.toLowerCase() !== channelTitle) {
          allTitles.push(t);
        }
      }
      
      if (allTitles.length === 0) {
        return { score: null, error: 'Tidak ada <item>/<title> ditemukan di RSS' };
      }
      
      return { score: null, trendingKeywords: allTitles, error: 'RSS parsed tanpa <item> wrapper' };
    }

    console.log(`[GoogleTrends] RSS feed: ${titles.length} trending topics ditemukan`);
    return { score: null, trendingKeywords: titles };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[GoogleTrends] RSS fetch gagal: ${errMsg}`);
    return { score: null, error: errMsg };
  }
}

/**
 * Hitung relevance score keyword terhadap daftar trending keywords.
 * Score 0-100: persentase trending topics yang mengandung kata-kata dari keyword.
 */
function calculateRelevanceScore(keyword: string, trendingKeywords: string[]): number {
  if (!trendingKeywords || trendingKeywords.length === 0) return 0;

  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);

  if (keywordWords.length === 0) return 0;

  let matchCount = 0;
  for (const tk of trendingKeywords) {
    const tkLower = tk.toLowerCase();
    // Cek apakah minimal 50% kata kunci muncul di trending keyword
    const matchRatio = keywordWords.filter(w => tkLower.includes(w)).length / keywordWords.length;
    if (matchRatio >= 0.5) {
      matchCount++;
    }
  }

  return Math.round((matchCount / trendingKeywords.length) * 100);
}

/**
 * Fetch interest score — multi-tier fallback.
 * Tier 1: Google Trends Daily RSS Feed
 * Fallback: return null (graceful)
 */
async function fetchInterestScore(keyword: string): Promise<FetchResult> {
  const rssResult = await fetchTrendingKeywords();

  if (rssResult.trendingKeywords && rssResult.trendingKeywords.length > 0) {
    const score = calculateRelevanceScore(keyword, rssResult.trendingKeywords);
    console.log(`[GoogleTrends] "${keyword}" → score ${score} (dari ${rssResult.trendingKeywords.length} trending topics)`);
    return { score };
  }

  return { score: null, error: rssResult.error || 'RSS feed tanpa data' };
}

// ============================================================
// AUTH: BEARER TOKEN
// ============================================================

function validateBearerToken(request: NextRequest): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { valid: false, error: 'Header Authorization (Bearer token) wajib disertakan' };
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, error: 'Format Authorization harus: Bearer <token>' };
  }
  const token = parts[1];
  const apiSecretKey = process.env.API_SECRET_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!apiSecretKey && !cronSecret) {
    console.warn('⚠️ API_SECRET_KEY dan CRON_SECRET tidak diset — autentikasi Bearer dilewati');
    return { valid: true };
  }
  const isValidApiKey = apiSecretKey ? token === apiSecretKey : false;
  const isValidCronKey = cronSecret ? token === cronSecret : false;
  if (!isValidApiKey && !isValidCronKey) {
    return { valid: false, error: 'Bearer token tidak valid' };
  }
  return { valid: true };
}

// ============================================================
// SHARED CRAWL LOGIC
// ============================================================

async function handleCrawlRequest(request: NextRequest, source: 'manual' | 'cron') {
  const ip = getClientIp(request);
  const startTime = Date.now();

  // Rate limit layer 1
  const layer1 = await checkRateLimit(`layer1:${ip}`, 5, 60_000);
  if (!layer1.allowed) {
    return NextResponse.json({
      success: false,
      error: `Terlalu banyak request. Coba lagi dalam ${layer1.resetInSeconds} detik.`,
    }, { status: 429, headers: { 'Retry-After': layer1.resetInSeconds.toString(), 'X-RateLimit-Remaining': layer1.remaining.toString() } });
  }

  // Auth
  const auth = validateBearerToken(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  // Rate limit layer 2
  const layer2 = await checkRateLimit(`layer2:${ip}:crawl-google-trends`, 1, 60_000);
  if (!layer2.allowed) {
    return NextResponse.json({
      success: false,
      error: `Terlalu banyak request. Coba lagi dalam ${layer2.resetInSeconds} detik.`,
    }, { status: 429, headers: { 'Retry-After': layer2.resetInSeconds.toString(), 'X-RateLimit-Remaining': layer2.remaining.toString() } });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const allParam = searchParams.get('all') === 'true';

    if (!category && !allParam) {
      return NextResponse.json({
        success: false,
        error: `Parameter ?category= wajib diisi. Pilihan: ${Object.keys(CATEGORY_KEYWORDS).join(', ')}. Atau gunakan ?all=true.`,
      }, { status: 400 });
    }

    let categoriesToCrawl: string[];
    if (allParam) {
      categoriesToCrawl = Object.keys(CATEGORY_KEYWORDS);
    } else {
      if (!CATEGORY_KEYWORDS[category]) {
        return NextResponse.json({
          success: false,
          error: `Kategori "${category}" tidak valid. Pilihan: ${Object.keys(CATEGORY_KEYWORDS).join(', ')}`,
        }, { status: 400 });
      }
      categoriesToCrawl = [category];
    }

    const supabase = createServiceRoleClient();
    const allResults: Array<{ keyword: string; signal_value: number | null; status: string; error?: string }> = [];
    let totalInserted = 0;
    let totalFailed = 0;

    for (const catSlug of categoriesToCrawl) {
      const { data: categoryData } = await supabase
        .from('content_categories')
        .select('id')
        .eq('slug', catSlug)
        .single();

      if (!categoryData) {
        console.warn(`[GoogleTrends] [${source}] Kategori "${catSlug}" tidak ditemukan — skip`);
        continue;
      }

      const categoryId = categoryData.id;
      const keywords = CATEGORY_KEYWORDS[catSlug];

      console.log(`[GoogleTrends] [${source}] Crawl "${catSlug}" (${keywords.length} keyword)`);

      for (const keyword of keywords) {
        const result = await fetchInterestScore(keyword);

        allResults.push({
          keyword,
          signal_value: result.score,
          status: result.score !== null ? 'success' : 'failed',
          error: result.error,
        });

        if (result.score !== null) {
          const { error: insertError } = await supabase.from('trend_signals').insert({
            category_id: categoryId,
            source: 'google_trends',
            keyword,
            signal_value: result.score,
            raw_context: null,
          });

          if (insertError) {
            console.warn(`[GoogleTrends] [${source}] Gagal insert "${keyword}": ${insertError.message}`);
            totalFailed++;
          } else {
            totalInserted++;
          }
        } else {
          totalFailed++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[GoogleTrends] [${source}] ✅ ${totalInserted} inserted, ${totalFailed} failed (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      data: { categories: categoriesToCrawl, results: allResults, totalInserted, totalFailed, elapsedMs: elapsed, source },
    });
  } catch (error) {
    console.error(`[GoogleTrends] [${source}] Error:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi kesalahan saat crawl Google Trends',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleCrawlRequest(request, 'manual');
}

export async function GET(request: NextRequest) {
  return handleCrawlRequest(request, 'cron');
}