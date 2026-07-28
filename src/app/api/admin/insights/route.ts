/**
 * Admin Insights API — read-only dashboard data
 * Proteksi sederhana: Bearer token atau query param ?secret=API_SECRET_KEY
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateAllNarratives } from '@/lib/insight-narrative';

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 });
}

export async function GET(request: NextRequest) {
  // === Proteksi sederhana ===
  const apiKey = process.env.API_SECRET_KEY;
  if (apiKey) {
    const authHeader = request.headers.get('authorization') || '';
    const secretParam = request.nextUrl.searchParams.get('secret');

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch ? bearerMatch[1] : '';

    if (bearerToken !== apiKey && secretParam !== apiKey) {
      return unauthorized('Invalid or missing API key. Provide via Authorization: Bearer <key> or ?secret=<key>');
    }
  }

  const supabase = createServerClient();

  // === 1. Ambil semua kategori ===
  const { data: categories, error: catErr } = await supabase
    .from('content_categories')
    .select('id, slug, name')
    .order('slug');

  if (catErr) {
    return NextResponse.json({ error: 'Failed to fetch categories', detail: catErr.message }, { status: 500 });
  }

  if (!categories || categories.length === 0) {
    return NextResponse.json({ categories: [], patternInsights: [], crawlProgress: [], topVideos: [] });
  }

  const categoryIds = categories.map(c => c.id);

  // === 2. Pattern insights per kategori ===
  const { data: patternInsights, error: piErr } = await supabase
    .from('pattern_insights')
    .select('*')
    .in('category_id', categoryIds)
    .order('avg_view_count', { ascending: false });

  if (piErr) {
    return NextResponse.json({ error: 'Failed to fetch pattern insights', detail: piErr.message }, { status: 500 });
  }

  // === 3. Crawl progress: content_samples per kategori per hari (7 hari terakhir) ===
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: crawlProgress, error: cpErr } = await supabase
    .from('content_samples')
    .select('category_id, captured_at')
    .gte('captured_at', sevenDaysAgo.toISOString())
    .order('captured_at', { ascending: true });

  if (cpErr) {
    return NextResponse.json({ error: 'Failed to fetch crawl progress', detail: cpErr.message }, { status: 500 });
  }

  // Group by category + date
  const crawlMap: Record<string, Record<string, number>> = {};
  for (const row of crawlProgress || []) {
    const catId = row.category_id;
    const date = new Date(row.captured_at).toISOString().split('T')[0];
    if (!crawlMap[catId]) crawlMap[catId] = {};
    crawlMap[catId][date] = (crawlMap[catId][date] || 0) + 1;
  }

  // === 4. Top 5 videos per kategori (by view_count) ===
  const topVideosByCategory: Record<string, any[]> = {};

  for (const catId of categoryIds) {
    const { data: videos, error: tvErr } = await supabase
      .from('content_samples')
      .select('id, title, view_count, duration_seconds, external_id, captured_at')
      .eq('category_id', catId)
      .not('view_count', 'is', null)
      .order('view_count', { ascending: false })
      .limit(5);

    if (tvErr) continue;
    topVideosByCategory[catId] = videos || [];
  }

  // === 5. Baseline avg views per kategori ===
  const baselineMap: Record<string, number> = {};
  for (const catId of categoryIds) {
    const { data: avgData } = await supabase
      .from('content_samples')
      .select('view_count')
      .eq('category_id', catId)
      .not('view_count', 'is', null);

    if (avgData && avgData.length > 0) {
      const sum = avgData.reduce((acc, r) => acc + (r.view_count || 0), 0);
      baselineMap[catId] = Math.round(sum / avgData.length);
    } else {
      baselineMap[catId] = 0;
    }
  }

  // === 6. Generate narratives per category ===
  const narratives = generateAllNarratives(
    patternInsights || [],
    baselineMap,
    categories.map(c => ({ id: c.id, name: c.name })),
  );

  return NextResponse.json({
    categories,
    patternInsights: patternInsights || [],
    crawlProgress: {
      raw: crawlProgress || [],
      grouped: crawlMap,
    },
    topVideos: topVideosByCategory,
    baselines: baselineMap,
    narratives,
  });
}