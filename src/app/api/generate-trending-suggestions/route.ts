/**
 * API Route: Generate Trending Suggestions — untuk Vercel Cron & manual trigger
 *
 * DUAL MODE:
 *   GET /api/generate-trending-suggestions
 *     → Vercel Cron (otomatis) — auth: Bearer CRON_SECRET
 *     → Manual test — auth: Bearer API_SECRET_KEY atau CRON_SECRET
 *
 * Logic sama dengan src/jobs/generate-trending-suggestions.ts:
 * 1. Ambil semua kategori (kecuali affiliate & custom)
 * 2. Tiap kategori: ambil TOP 10 video by view_count dari content_samples
 * 3. Kirim ke LLM (1 panggilan per kategori) untuk ekstrak 5 suggestion topik
 * 4. Simpan hasil ke trending_suggestions (ganti data lama per kategori)
 *
 * Schedule di vercel.json: 0 5 * * * (1x/hari jam 05:00 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { aiCompletion } from '@/lib/ai/completion';

// ============================================================
// KONSTANTA
// ============================================================

const LLM_MODEL = process.env.LLM_TRENDING_MODEL || 'llama-3.3-70b-versatile';
const TOP_N = 10;
const SUGGESTIONS_PER_CATEGORY = 5;
const SKIP_CATEGORIES = new Set(['affiliate', 'custom']);

// ============================================================
// TIPE DATA
// ============================================================

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

interface ContentSampleRow {
  id: string;
  title: string;
  view_count: number;
}

interface TrendingSuggestionInsert {
  category_id: string;
  suggestion_text: string;
  source_pattern: string | null;
}

interface CategoryResult {
  slug: string;
  name: string;
  status: 'success' | 'skipped' | 'error';
  suggestions_count: number;
  message?: string;
}

// ============================================================
// PROMPT LLM
// ============================================================

function buildPrompt(categoryName: string, titles: string[]): { system: string; user: string } {
  const system = `Anda adalah analis tren konten Indonesia yang ahli mengekstrak tema dan angle populer dari data video.

Tugas Anda: dari daftar judul video top performer, buatkan ${SUGGESTIONS_PER_CATEGORY} suggestion topik yang:
- BUKAN judul mentah dari video yang ada
- TAPI tema/angle umum yang bisa dipakai sebagai inspirasi bikin konten baru
- Relevan dengan kategori: "${categoryName}"
- Spesifik untuk audiens Indonesia
- Dalam bahasa Indonesia yang natural

Format output: JSON array of strings, contoh:
["Tema/angle 1", "Tema/angle 2", "Tema/angle 3", "Tema/angle 4", "Tema/angle 5"]`;

  const user = `Berikut adalah ${titles.length} judul video top performer di kategori "${categoryName}":

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Buatkan ${SUGGESTIONS_PER_CATEGORY} suggestion topik (tema/angle, BUKAN judul mentah) yang bisa dipakai bikin konten baru.`;

  return { system, user };
}

// ============================================================
// EKSTRAK JSON DARI RESPON LLM
// ============================================================

function extractJsonArray(raw: string): string[] {
  // Coba parse langsung
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s).trim()).filter(s => s.length > 0);
    }
  } catch {
    // fallback
  }

  // Coba cari [...] di dalam teks
  const match = raw.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(s => String(s).trim()).filter(s => s.length > 0);
      }
    } catch {
      // gagal parse
    }
  }

  // Fallback: split by newline
  const lines = raw
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["'\-\*\s]+/, '').replace(/["',;\s]+$/, '').trim())
    .filter(l => l.length > 5);

  return lines.length > 0 ? lines.slice(0, SUGGESTIONS_PER_CATEGORY) : [];
}

// ============================================================
// AUTH
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

  // Jika kedua env var tidak diset, skip auth (development mode)
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
// PROSES SATU KATEGORI
// ============================================================

async function processCategory(
  category: CategoryRow,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<CategoryResult> {
  const baseResult: CategoryResult = {
    slug: category.slug,
    name: category.name,
    status: 'error',
    suggestions_count: 0,
  };

  try {
    // 1. Ambil TOP N video by view_count
    const { data: samples, error: sampError } = await supabase
      .from('content_samples')
      .select('id, title, view_count')
      .eq('category_id', category.id)
      .not('view_count', 'is', null)
      .order('view_count', { ascending: false })
      .limit(TOP_N);

    if (sampError) {
      return { ...baseResult, status: 'error', message: `Gagal query samples: ${sampError.message}` };
    }

    if (!samples || samples.length === 0) {
      return { ...baseResult, status: 'skipped', message: 'Belum ada data content_samples' };
    }

    const validSamples = samples as ContentSampleRow[];

    // 2. Kirim ke LLM
    const { system, user } = buildPrompt(category.name, validSamples.map(s => s.title));
    const result = await aiCompletion({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 1024,
      temperature: 0.8,
    });

    // 3. Ekstrak suggestions
    const suggestions = extractJsonArray(result.content);
    if (suggestions.length === 0) {
      return { ...baseResult, status: 'error', message: 'LLM tidak mengembalikan suggestion yang valid' };
    }

    // 4. Hapus data lama untuk kategori ini
    await supabase
      .from('trending_suggestions')
      .delete()
      .eq('category_id', category.id);

    // 5. Insert suggestions baru
    const inserts: TrendingSuggestionInsert[] = suggestions.map(text => ({
      category_id: category.id,
      suggestion_text: text,
      source_pattern: `generated from top ${validSamples.length} videos`,
    }));

    const { error: insError } = await supabase
      .from('trending_suggestions')
      .insert(inserts);

    if (insError) {
      return { ...baseResult, status: 'error', message: `Gagal insert: ${insError.message}` };
    }

    return {
      slug: category.slug,
      name: category.name,
      status: 'success',
      suggestions_count: inserts.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...baseResult, status: 'error', message: msg };
  }
}

// ============================================================
// HANDLER: GET — untuk Vercel Cron
// ============================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // ===== AUTH CHECK =====
  const auth = validateBearerToken(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();

    // 1. Ambil semua kategori
    const { data: categories, error: catError } = await supabase
      .from('content_categories')
      .select('id, slug, name');

    if (catError) {
      return NextResponse.json(
        { success: false, error: `Gagal mengambil categories: ${catError.message}` },
        { status: 500 }
      );
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({ success: true, data: { categories_processed: 0, results: [] } });
    }

    const filteredCategories = (categories as CategoryRow[])
      .filter(cat => !SKIP_CATEGORIES.has(cat.slug));

    // 2. Proses tiap kategori
    const results: CategoryResult[] = [];
    for (const category of filteredCategories) {
      const result = await processCategory(category, supabase);
      results.push(result);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const totalSuggestions = results.reduce((sum, r) => sum + r.suggestions_count, 0);

    const elapsed = Date.now() - startTime;

    console.log(`[GenerateTrending] ✅ Selesai: ${successCount} success, ${skippedCount} skipped, ${errorCount} error (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      data: {
        categories_total: categories.length,
        categories_processed: filteredCategories.length,
        categories_skipped: categories.length - filteredCategories.length,
        results,
        summary: {
          success: successCount,
          skipped: skippedCount,
          error: errorCount,
          total_suggestions: totalSuggestions,
        },
        elapsed_ms: elapsed,
      },
    });
  } catch (error) {
    console.error('[GenerateTrending] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat generate trending suggestions',
      },
      { status: 500 }
    );
  }
}