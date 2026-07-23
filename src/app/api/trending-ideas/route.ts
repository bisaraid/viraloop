import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/trending-ideas?category=horror
 *
 * Fetch trending ideas dari YouTube Data API v3
 * Query: "[kategori] viral indonesia"
 * Cache 1 jam via Map
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const API_BASE = 'https://www.googleapis.com/youtube/v3/search';

const cache = new Map<string, { ideas: string[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

const CATEGORY_QUERY_MAP: Record<string, string> = {
  horror: 'horor seram',
  psychology: 'psikologi fakta unik',
  romance: 'romantis cerita cinta',
  motivation: 'motivasi hidup sukses',
  education: 'edukasi fakta menarik',
  affiliate: '',
};

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') || '';

  if (!category || !CATEGORY_QUERY_MAP[category]) {
    return NextResponse.json({ success: false, error: 'Kategori tidak valid' }, { status: 400 });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'YouTube API key tidak dikonfigurasi' },
      { status: 503 }
    );
  }

  // Cek cache
  const cacheKey = `trending:${category}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, ideas: cached.ideas });
  }

  try {
    const query = `${CATEGORY_QUERY_MAP[category]} viral indonesia`;
    const url = new URL(API_BASE);
    url.searchParams.set('key', YOUTUBE_API_KEY);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('type', 'video');
    url.searchParams.set('regionCode', 'ID');
    url.searchParams.set('relevanceLanguage', 'id');

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Trending] YouTube API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errText,
        queryUsed: query,
      });
      return NextResponse.json(
        { success: false, error: `Gagal fetch trending (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const ideas: string[] = [];

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const title = item.snippet?.title || '';
        if (title && title.length > 5 && title.length < 120) {
          ideas.push(title);
        }
        if (ideas.length >= 5) break;
      }
    }

    // Cache hasil
    cache.set(cacheKey, { ideas, timestamp: Date.now() });

    return NextResponse.json({ success: true, ideas });
  } catch (error) {
    console.error('Trending ideas error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil ide trending' },
      { status: 500 }
    );
  }
}