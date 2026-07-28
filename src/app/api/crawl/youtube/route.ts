/**
 * YouTube Trending Crawler — API Route
 *
 * Memanggil YouTube Data API v3 untuk mengambil video trending per kategori,
 * lalu menyimpannya ke tabel content_samples.
 *
 * Endpoint: POST /api/crawl/youtube
 * Auth: Bearer token (API_SECRET_KEY)
 *
 * Strategi hemat quota:
 * - 1 kategori per panggilan (parameter ?category=horror)
 * - search.list = 100 quota, videos.list = 1 quota per video (batch)
 * - Total ~150 quota per kategori per hari
 * - Maks 1x/hari per kategori (dijaga oleh caller/cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service';

// ============================================================
// TIPE DATA
// ============================================================

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    publishedAt: string;
    channelTitle: string;
  };
}

interface YouTubeVideoItem {
  id: string;
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration: string; // ISO 8601 format: PT#M#S
  };
}

interface YouTubeApiResponse<T> {
  items: T[];
  error?: { message: string; code: number };
}

// ============================================================
// KEYWORD MAPPING PER KATEGORI
// ============================================================
// Keyword diambil dari exampleScenes & hookAngles di file kategori masing-masing
// untuk memastikan relevansi dengan konten yang akan digenerate.

// Keys SESUAI dengan slug di tabel content_categories (seed.sql):
//   horror, psikologi, romance, motivasi, edukasi
// (affiliate tidak di-crawl karena bukan short-form content)
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
};

// ============================================================
// YOUTUBE API HELPERS
// ============================================================

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Parse ISO 8601 duration string ke detik
 * Contoh: PT1M30S → 90, PT3M → 180, PT45S → 45
 */
function parseDurationToSeconds(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Panggil YouTube Data API search.list
 * Quota cost: 100 per request
 */
async function searchYouTubeVideos(
  keyword: string,
  maxResults: number = 50
): Promise<YouTubeSearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY tidak ditemukan di environment variables');
  }

  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', keyword);
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('videoDuration', 'short');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('key', apiKey);
  url.searchParams.set('relevanceLanguage', 'id');
  url.searchParams.set('regionCode', 'ID');

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube search.list gagal (HTTP ${response.status}): ${errorText}`);
  }

  const data: YouTubeApiResponse<YouTubeSearchItem> = await response.json();

  if (data.error) {
    throw new Error(`YouTube API error: ${data.error.message} (code ${data.error.code})`);
  }

  return data.items || [];
}

/**
 * Panggil YouTube Data API videos.list untuk ambil statistics & contentDetails
 * Quota cost: 1 per video ID (dibatch dalam 1 request)
 */
async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) return [];

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY tidak ditemukan di environment variables');
  }

  // Batch maksimal 50 ID per request
  const batchSize = 50;
  const allResults: YouTubeVideoItem[] = [];

  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);

    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set('part', 'statistics,contentDetails');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[YouTube] videos.list batch gagal (HTTP ${response.status}): ${errorText}`);
      continue;
    }

    const data: YouTubeApiResponse<YouTubeVideoItem> = await response.json();

    if (data.error) {
      console.warn(`[YouTube] videos.list error: ${data.error.message}`);
      continue;
    }

    allResults.push(...(data.items || []));
  }

  return allResults;
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
  const expectedToken = process.env.API_SECRET_KEY;

  if (!expectedToken) {
    console.warn('⚠️ API_SECRET_KEY tidak diset — autentikasi Bearer dilewati');
    return { valid: true };
  }

  if (token !== expectedToken) {
    return { valid: false, error: 'Bearer token tidak valid' };
  }

  return { valid: true };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const startTime = Date.now();

  // ===== LAPISAN 1: Rate limit universal =====
  const layer1 = await checkRateLimit(`layer1:${ip}`, 5, 60_000);
  if (!layer1.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak request. Coba lagi dalam ${layer1.resetInSeconds} detik.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': layer1.resetInSeconds.toString(),
          'X-RateLimit-Remaining': layer1.remaining.toString(),
        },
      }
    );
  }

  // ===== AUTH CHECK (Bearer token) =====
  const auth = validateBearerToken(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  // ===== LAPISAN 2: Rate limit per jalur =====
  const layer2 = await checkRateLimit(`layer2:${ip}:crawl-youtube`, 1, 60_000);
  if (!layer2.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak request. Coba lagi dalam ${layer2.resetInSeconds} detik.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': layer2.resetInSeconds.toString(),
          'X-RateLimit-Remaining': layer2.remaining.toString(),
        },
      }
    );
  }

  try {
    // ===== PARSE PARAMETER =====
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    if (!category) {
      return NextResponse.json(
        { success: false, error: `Parameter ?category= wajib diisi. Pilihan: ${Object.keys(CATEGORY_KEYWORDS).join(', ')}` },
        { status: 400 }
      );
    }

    const keywords = CATEGORY_KEYWORDS[category];
    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error: `Kategori "${category}" tidak valid. Pilihan: ${Object.keys(CATEGORY_KEYWORDS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Key CATEGORY_KEYWORDS sudah menggunakan slug database, jadi langsung pakai
    const slug = category;

    // ===== AMBIL CATEGORY ID DARI DATABASE =====
    const supabase = createServiceRoleClient();

    const { data: categoryData, error: categoryError } = await supabase
      .from('content_categories')
      .select('id')
      .eq('slug', slug)
      .single();

    if (categoryError || !categoryData) {
      return NextResponse.json(
        { success: false, error: `Kategori dengan slug "${slug}" tidak ditemukan di database` },
        { status: 404 }
      );
    }

    const categoryId = categoryData.id;

    // ===== CRAWL YOUTUBE =====
    console.log(`[YouTubeCrawl] Mulai crawl kategori "${category}" (${keywords.length} keyword)`);

    const allVideoIds: string[] = [];
    const searchResults: Array<{
      videoId: string;
      title: string;
      publishedAt: string;
      keyword: string;
    }> = [];

    // Crawl setiap keyword (maks 2 keyword per panggilan untuk hemat quota)
    const keywordsToUse = keywords.slice(0, 2);

    for (const keyword of keywordsToUse) {
      console.log(`[YouTubeCrawl] Search keyword: "${keyword}"`);
      const items = await searchYouTubeVideos(keyword, 50);

      for (const item of items) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;

        // Hindari duplikat dalam 1 sesi crawl
        if (allVideoIds.includes(videoId)) continue;

        allVideoIds.push(videoId);
        searchResults.push({
          videoId,
          title: item.snippet?.title || '',
          publishedAt: item.snippet?.publishedAt || '',
          keyword,
        });
      }

      // Jeda kecil antar keyword untuk避免 rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[YouTubeCrawl] Ditemukan ${searchResults.length} video unik, mengambil detail...`);

    // ===== AMBIL DETAIL VIDEO (statistics + duration) =====
    const videoDetails = await getVideoDetails(allVideoIds);

    // Map video details by ID
    const detailsMap = new Map<string, YouTubeVideoItem>();
    for (const detail of videoDetails) {
      detailsMap.set(detail.id, detail);
    }

    // ===== SIMPAN KE CONTENT_SAMPLES =====
    let insertedCount = 0;
    let skippedCount = 0;

    for (const result of searchResults) {
      const detail = detailsMap.get(result.videoId);

      const viewCount = detail?.statistics?.viewCount
        ? parseInt(detail.statistics.viewCount, 10)
        : null;
      const likeCount = detail?.statistics?.likeCount
        ? parseInt(detail.statistics.likeCount, 10)
        : null;
      const commentCount = detail?.statistics?.commentCount
        ? parseInt(detail.statistics.commentCount, 10)
        : null;
      const durationSeconds = detail?.contentDetails?.duration
        ? parseDurationToSeconds(detail.contentDetails.duration)
        : null;

      // Skip video tanpa view count (mungkin restricted/deleted)
      if (viewCount === null) {
        skippedCount++;
        continue;
      }

      const { error: insertError } = await supabase.from('content_samples').insert({
        category_id: categoryId,
        platform: 'youtube',
        external_id: result.videoId,
        title: result.title,
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        duration_seconds: durationSeconds,
        published_at: result.publishedAt || null,
        pattern_tags: { keyword: result.keyword },
      });

      if (insertError) {
        // Duplicate key (unique constraint platform+external_id) — skip
        if (insertError.code === '23505') {
          skippedCount++;
        } else {
          console.warn(`[YouTubeCrawl] Gagal insert video ${result.videoId}:`, insertError.message);
          skippedCount++;
        }
      } else {
        insertedCount++;
      }
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `[YouTubeCrawl] ✅ Selesai: ${insertedCount} inserted, ${skippedCount} skipped (${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      data: {
        category,
        keywordCount: keywordsToUse.length,
        totalFound: searchResults.length,
        inserted: insertedCount,
        skipped: skippedCount,
        elapsedMs: elapsed,
      },
    });
  } catch (error) {
    console.error('[YouTubeCrawl] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat crawl YouTube',
      },
      { status: 500 }
    );
  }
}