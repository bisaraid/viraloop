/**
 * Job: Generate Trending Suggestions — Generate & cache suggestion topik untuk fitur "Trending".
 *
 * Cara kerja:
 * 1. Ambil semua kategori (kecuali affiliate & custom)
 * 2. Untuk tiap kategori, ambil TOP 10 video by view_count dari content_samples
 * 3. Kirim judul-judul itu ke LLM (1 panggilan per kategori) dengan prompt:
 *    "Dari judul-judul video top performer berikut, ekstrak 5 suggestion topik yang relevan
 *     (bukan judul mentah, tapi tema/angle yang bisa dipakai bikin konten)."
 * 4. Simpan hasil ke trending_suggestions (ganti data lama per kategori)
 *
 * Cara pakai:
 *   npx tsx --env-file=.env src/jobs/generate-trending-suggestions.ts
 *
 * Schedule (cron): 1x per hari jam 05:00 UTC — SETELAH semua crawl kategori selesai
 * (crawl terakhir: edukasi jam 22:00 UTC hari sebelumnya).
 * Dijadwalkan via Vercel Cron Jobs di vercel.json.
 */

import { createServiceRoleClient } from '../lib/supabase/service';
import { aiCompletion } from '../lib/ai/completion';

// ============================================================
// KONSTANTA
// ============================================================

const LLM_MODEL = process.env.LLM_TRENDING_MODEL || 'llama-3.3-70b-versatile';
const TOP_N = 10;
const SUGGESTIONS_PER_CATEGORY = 5;

/** Kategori yang dilewati (tidak punya data video/content_samples yang relevan) */
const SKIP_CATEGORIES = new Set(['affiliate', 'custom']);

// ============================================================
// TIPE DATA LOKAL
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
    // fallback: cari array di dalam teks
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

  // Fallback: split by newline atau koma
  const lines = raw
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["'\-\*\s]+/, '').replace(/["',;\s]+$/, '').trim())
    .filter(l => l.length > 5);

  return lines.length > 0 ? lines.slice(0, SUGGESTIONS_PER_CATEGORY) : [];
}

// ============================================================
// MAIN FUNCTION
// ============================================================

async function main() {
  console.log('🔥 Generate Trending Suggestions — Membuat suggestion topik dari data video top performer\n');

  const supabase = createServiceRoleClient();

  // ========================================
  // 1. AMBIL SEMUA CATEGORIES (kecuali skip list)
  // ========================================
  console.log('📡 Mengambil categories...');
  const { data: categories, error: catError } = await supabase
    .from('content_categories')
    .select('id, slug, name');

  if (catError) {
    console.error('❌ Gagal mengambil categories:', catError.message);
    process.exit(1);
  }

  if (!categories || categories.length === 0) {
    console.log('📭 Tidak ada categories.');
    process.exit(0);
  }

  const filteredCategories = (categories as CategoryRow[])
    .filter(cat => !SKIP_CATEGORIES.has(cat.slug));

  console.log(`✅ Ditemukan ${categories.length} categories, ${filteredCategories.length} akan diproses (skip: ${[...SKIP_CATEGORIES].join(', ')}).\n`);

  // ========================================
  // 2. PROSES PER KATEGORI
  // ========================================

  let totalSuggestions = 0;
  const categoryResults: Array<{ slug: string; name: string; count: number }> = [];

  for (const category of filteredCategories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📂 ${category.name} (${category.slug})`);
    console.log(`${'='.repeat(60)}`);

    // 2a. Ambil TOP 10 video by view_count
    console.log(`  📡 Mengambil TOP ${TOP_N} video...`);
    const { data: samples, error: sampError } = await supabase
      .from('content_samples')
      .select('id, title, view_count')
      .eq('category_id', category.id)
      .not('view_count', 'is', null)
      .order('view_count', { ascending: false })
      .limit(TOP_N);

    if (sampError) {
      console.error(`  ❌ Gagal mengambil content_samples:`, sampError.message);
      continue;
    }

    if (!samples || samples.length === 0) {
      console.log(`  📭 Tidak ada content_samples untuk kategori ini.`);
      continue;
    }

    const validSamples = samples as ContentSampleRow[];
    console.log(`  ✅ ${validSamples.length} video ditemukan (range views: ${validSamples[validSamples.length - 1]?.view_count?.toLocaleString() ?? 'N/A'} - ${validSamples[0]?.view_count?.toLocaleString() ?? 'N/A'})`);

    // Tampilkan judul-judul yang akan dikirim
    console.log(`  📋 Judul yang dikirim ke LLM:`);
    for (const s of validSamples) {
      console.log(`     ${s.view_count.toLocaleString().padStart(12)} views | ${s.title}`);
    }

    // 2b. Kirim ke LLM
    console.log(`  🤖 Mengirim ke LLM (model: ${LLM_MODEL})...`);
    const { system, user } = buildPrompt(category.name, validSamples.map(s => s.title));

    try {
      const result = await aiCompletion({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      });

      console.log(`  ✅ LLM merespon (${result.usage?.total_tokens ?? '?'} tokens)`);

      // 2c. Ekstrak suggestions dari JSON
      const suggestions = extractJsonArray(result.content);
      console.log(`  📊 Ekstraksi: ${suggestions.length} suggestions`);
      for (const s of suggestions) {
        console.log(`     💡 ${s}`);
      }

      if (suggestions.length === 0) {
        console.warn(`  ⚠️ Tidak ada suggestion yang bisa diekstrak dari respon LLM.`);
        continue;
      }

      // 2d. Hapus data lama untuk kategori ini
      console.log(`  🧹 Membersihkan suggestions lama untuk kategori ${category.slug}...`);
      const { error: delError } = await supabase
        .from('trending_suggestions')
        .delete()
        .eq('category_id', category.id);

      if (delError) {
        console.error(`  ❌ Gagal membersihkan data lama:`, delError.message);
        // Lanjut insert — mungkin ada duplikasi
      } else {
        console.log(`  ✅ Suggestions lama dibersihkan.`);
      }

      // 2e. Insert suggestions baru
      const inserts: TrendingSuggestionInsert[] = suggestions.map(text => ({
        category_id: category.id,
        suggestion_text: text,
        source_pattern: `generated from top ${validSamples.length} videos`,
      }));

      const { error: insError } = await supabase
        .from('trending_suggestions')
        .insert(inserts);

      if (insError) {
        console.error(`  ❌ Gagal insert suggestions:`, insError.message);
        continue;
      }

      console.log(`  ✅ ${inserts.length} suggestions disimpan ke database.`);
      totalSuggestions += inserts.length;
      categoryResults.push({ slug: category.slug, name: category.name, count: inserts.length });

    } catch (llmError) {
      const msg = llmError instanceof Error ? llmError.message : String(llmError);
      console.error(`  ❌ Gagal memanggil LLM: ${msg}`);
      console.log(`  ⏭️  Skipping kategori ${category.name}...`);
      continue;
    }
  }

  // ========================================
  // 3. RINGKASAN
  // ========================================
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RINGKASAN');
  console.log(`${'='.repeat(60)}`);

  if (categoryResults.length === 0) {
    console.log('Tidak ada suggestion yang berhasil digenerate.');
  } else {
    for (const r of categoryResults) {
      console.log(`  ✅ ${r.name.padEnd(20)} | ${r.count} suggestions`);
    }
    console.log(`\n🎉 Total: ${totalSuggestions} trending suggestions disimpan.`);
  }

  console.log(`\n📌 Next: Cron 1x/hari jam 05:00 UTC di vercel.json — setelah semua crawl selesai.`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});