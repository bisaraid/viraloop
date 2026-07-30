/**
 * Reddit Crawler — API Route
 *
 * Mengambil top posts dari subreddit relevan per kategori,
 * lalu menyimpannya ke tabel trend_signals dengan source='reddit'.
 *
 * DUAL ENDPOINT (satu file route, dua method HTTP):
 *   POST /api/crawl/reddit?category=xxx
 *     → Manual trigger / testing (curl, Postman)
 *     → Auth: Bearer API_SECRET_KEY
 *
 *   GET /api/crawl/reddit?category=xxx
 *     → Vercel Cron Jobs (otomatis terjadwal)
 *     → Auth: Bearer CRON_SECRET
 *
 * Prasyarat:
 *   - REDDIT_CLIENT_ID dan REDDIT_CLIENT_SECRET harus diset di .env
 *   - Jika tidak diset, crawler akan return error graceful (tidak crash)
 *
 * Rate limit:
 *   - Reddit OAuth script app: 60 requests/menit
 *   - Crawler ini: maks 2 subreddit per kategori × 1 request per subreddit
 *   - Jeda 2 detik antar subreddit (di handle oleh RedditClient)
 *
 * Jadwal cron (vercel.json):
 *   Semua kategori di jam yang berbeda dari crawler lain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getRedditClient, CATEGORY_SUBREDDITS } from '@/lib/reddit-client';

// ============================================================
// AUTH: BEARER TOKEN (dual-mode, sama seperti crawler lain)
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

  // ===== AUTH CHECK =====
  const auth = validateBearerToken(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  // ===== LAPISAN 2: Rate limit per jalur =====
  const layer2 = await checkRateLimit(`layer2:${ip}:crawl-reddit`, 1, 60_000);
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
    // ===== CEK KONFIGURASI REDDIT =====
    const redditClient = getRedditClient();
    if (!redditClient.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'REDDIT_CLIENT_ID dan REDDIT_CLIENT_SECRET belum diset di environment variables. Crawler Reddit tidak dapat berjalan.',
        },
        { status: 503 }
      );
    }

    // ===== PARSE PARAMETER =====
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const allParam = searchParams.get('all') === 'true';
    const timeFilter = (searchParams.get('time') || 'day') as 'day' | 'week' | 'month' | 'year' | 'all';
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Math.min(Math.max(limitParam, 1), 25); // batas 1-25

    if (!category && !allParam) {
      return NextResponse.json(
        {
          success: false,
          error: `Parameter ?category= wajib diisi. Pilihan: ${Object.keys(CATEGORY_SUBREDDITS).join(', ')}. Atau gunakan ?all=true untuk semua kategori.`,
        },
        { status: 400 }
      );
    }

    // Tentukan kategori mana yang akan di-crawl
    let categoriesToCrawl: string[];
    if (allParam) {
      categoriesToCrawl = Object.keys(CATEGORY_SUBREDDITS);
    } else {
      if (!CATEGORY_SUBREDDITS[category]) {
        return NextResponse.json(
          {
            success: false,
            error: `Kategori "${category}" tidak valid. Pilihan: ${Object.keys(CATEGORY_SUBREDDITS).join(', ')}`,
          },
          { status: 400 }
        );
      }
      categoriesToCrawl = [category];
    }

    const supabase = createServiceRoleClient();
    const allResults: Array<{
      category: string;
      subreddit: string;
      title: string;
      score: number;
      status: string;
    }> = [];
    let totalInserted = 0;
    let totalFailed = 0;

    for (const catSlug of categoriesToCrawl) {
      // Ambil category_id dari database
      const { data: categoryData, error: categoryError } = await supabase
        .from('content_categories')
        .select('id')
        .eq('slug', catSlug)
        .single();

      if (categoryError || !categoryData) {
        console.warn(`[RedditCrawl] [${source}] Kategori "${catSlug}" tidak ditemukan di database — skip`);
        continue;
      }

      const categoryId = categoryData.id;

      console.log(`[RedditCrawl] [${source}] Crawl kategori "${catSlug}" (time=${timeFilter}, limit=${limit})`);

      const categoryPosts = await redditClient.getCategoryPosts(catSlug, timeFilter, limit);

      for (const { subreddit, posts } of categoryPosts) {
        console.log(`[RedditCrawl] [${source}] /r/${subreddit}: ${posts.length} posts ditemukan`);

        for (const post of posts) {
          allResults.push({
            category: catSlug,
            subreddit,
            title: post.title,
            score: post.score,
            status: 'inserted',
          });

          // Simpan ke trend_signals
          const { error: insertError } = await supabase.from('trend_signals').insert({
            category_id: categoryId,
            source: 'reddit',
            keyword: `r/${subreddit}`,
            signal_value: post.score,
            raw_context: post.title,
          });

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate — skip (walaupun kecil kemungkinan karena tidak ada unique constraint)
              console.warn(`[RedditCrawl] [${source}] Duplicate post: "${post.title.substring(0, 50)}..."`);
            } else {
              console.warn(`[RedditCrawl] [${source}] Gagal insert post:`, insertError.message);
            }
            totalFailed++;
          } else {
            totalInserted++;
          }
        }
      }
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `[RedditCrawl] [${source}] ✅ Selesai: ${totalInserted} inserted, ${totalFailed} failed (${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesToCrawl,
        timeFilter,
        limit,
        results: allResults,
        totalInserted,
        totalFailed,
        elapsedMs: elapsed,
        source,
      },
    });
  } catch (error) {
    console.error(`[RedditCrawl] [${source}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat crawl Reddit',
      },
      { status: 500 }
    );
  }
}

// ============================================================
// HANDLER: POST — manual trigger
// ============================================================

export async function POST(request: NextRequest) {
  return handleCrawlRequest(request, 'manual');
}

// ============================================================
// HANDLER: GET — Vercel Cron Jobs
// ============================================================

export async function GET(request: NextRequest) {
  return handleCrawlRequest(request, 'cron');
}