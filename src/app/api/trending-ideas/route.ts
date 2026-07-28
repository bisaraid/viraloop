/**
 * GET /api/trending-ideas?category=horror
 *
 * Mengambil trending suggestions dari tabel trending_suggestions (di-cache).
 * Data ini digenerate oleh job generate-trending-suggestions (1x/hari jam 05:00 UTC).
 *
 * Public endpoint — RLS sudah public read, tidak perlu auth khusus.
 * Bisa dipanggil langsung dari browser user.
 *
 * Response: { success: true, ideas: string[] }
 * Jika tidak ada data: { success: true, ideas: [] } — BUKAN error
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') || '';

  if (!category) {
    return NextResponse.json({ success: false, error: 'Parameter ?category= wajib diisi' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Cari category_id dari slug
    const { data: catData, error: catError } = await supabase
      .from('content_categories')
      .select('id')
      .eq('slug', category)
      .single();

    if (catError || !catData) {
      // Kategori tidak ditemukan — return empty, bukan error
      return NextResponse.json({ success: true, ideas: [] });
    }

    // Ambil suggestions terbaru untuk kategori ini
    const { data: suggestions, error: sugError } = await supabase
      .from('trending_suggestions')
      .select('suggestion_text')
      .eq('category_id', catData.id)
      .order('generated_at', { ascending: false })
      .limit(5);

    if (sugError) {
      console.error('[TrendingIdeas] Error query suggestions:', sugError.message);
      return NextResponse.json({ success: true, ideas: [] });
    }

    const ideas = (suggestions || []).map(s => s.suggestion_text).filter(Boolean);

    return NextResponse.json({ success: true, ideas });
  } catch (error) {
    console.error('[TrendingIdeas] Error:', error);
    // Return empty array instead of error — graceful degradation
    return NextResponse.json({ success: true, ideas: [] });
  }
}