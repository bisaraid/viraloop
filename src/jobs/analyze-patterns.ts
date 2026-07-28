/**
 * Job: Analyze Patterns — Cari tahu pattern mana yang berkorelasi views tinggi per kategori.
 *
 * Cara pakai:
 *   npx tsx --env-file=.env src/jobs/analyze-patterns.ts
 *
 * Cara kerja:
 * 1. Ambil data dari content_samples + content_categories (join via category_id)
 * 2. Kelompokkan per kategori + tiap pattern tag (hook_type, duration_bucket, title_length_bucket)
 * 3. Hitung rata-rata view_count per grup
 * 4. Hitung rata-rata view_count keseluruhan per kategori sebagai baseline
 * 5. Bandingkan — pattern mana yang di atas rata-rata kategori?
 * 6. Simpan hasil ke tabel pattern_insights
 */

import { createServiceRoleClient } from '../lib/supabase/service';

// ============================================================
// TIPE DATA LOKAL
// ============================================================

interface ContentSampleRow {
  id: string;
  category_id: string;
  view_count: number | null;
  pattern_tags: Record<string, string> | null;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

interface PatternKey {
  category_id: string;
  category_slug: string;
  pattern_key: string;
  pattern_value: string;
}

interface GroupStats {
  avg_view_count: number;
  sample_count: number;
}

// ============================================================
// PATTERN KEYS YANG AKAN DIANALISA
// ============================================================

const PATTERN_KEYS = ['hook_type', 'duration_bucket', 'title_length_bucket'] as const;

// ============================================================
// MAIN FUNCTION
// ============================================================

async function main() {
  console.log('📊 Analyze Patterns — Mencari korelasi pattern vs views per kategori\n');

  const supabase = createServiceRoleClient();

  // ========================================
  // 1. AMBIL SEMUA CATEGORIES
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

  console.log(`✅ Ditemukan ${categories.length} categories.\n`);

  // ========================================
  // 2. AMBIL SEMUA CONTENT SAMPLES + JOIN CATEGORY
  // ========================================
  console.log('📡 Mengambil content_samples...');
  const { data: samples, error: sampError } = await supabase
    .from('content_samples')
    .select('id, category_id, view_count, pattern_tags');

  if (sampError) {
    console.error('❌ Gagal mengambil content_samples:', sampError.message);
    process.exit(1);
  }

  if (!samples || samples.length === 0) {
    console.log('📭 Tidak ada content_samples.');
    process.exit(0);
  }

  console.log(`✅ Ditemukan ${samples.length} content_samples.\n`);

  // ========================================
  // 3. HITUNG BASELINE PER KATEGORI (rata-rata view seluruh samples di kategori itu)
  // ========================================
  console.log('📊 Menghitung baseline rata-rata view per kategori...');

  const categoryBaselines = new Map<string, { avg: number; total: number; count: number }>();

  for (const sample of samples as ContentSampleRow[]) {
    if (sample.view_count === null) continue;

    const catId = sample.category_id;
    if (!categoryBaselines.has(catId)) {
      categoryBaselines.set(catId, { avg: 0, total: 0, count: 0 });
    }
    const baseline = categoryBaselines.get(catId)!;
    baseline.total += sample.view_count;
    baseline.count += 1;
  }

  // Hitung rata-rata
  for (const [catId, baseline] of categoryBaselines) {
    baseline.avg = baseline.count > 0 ? baseline.total / baseline.count : 0;
  }

  console.log(`✅ Baseline dihitung untuk ${categoryBaselines.size} kategori.\n`);

  // ========================================
  // 4. KELOMPOKKAN PER KATEGORI + Tiap PATTERN TAG
  // ========================================
  console.log('📊 Mengelompokkan samples per (category, pattern_key, pattern_value)...');

  // Map: key = "category_id|pattern_key|pattern_value" → GroupStats
  const groupMap = new Map<string, GroupStats>();

  for (const sample of samples as ContentSampleRow[]) {
    if (sample.view_count === null) continue;
    if (!sample.pattern_tags) continue;

    const catId = sample.category_id;

    for (const patternKey of PATTERN_KEYS) {
      const patternValue = sample.pattern_tags[patternKey];
      if (!patternValue) continue;

      const groupKey = `${catId}|${patternKey}|${patternValue}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { avg_view_count: 0, sample_count: 0 });
      }
      const group = groupMap.get(groupKey)!;
      group.avg_view_count = (group.avg_view_count * group.sample_count + sample.view_count) / (group.sample_count + 1);
      group.sample_count += 1;
    }
  }

  console.log(`✅ Terbentuk ${groupMap.size} grup.\n`);

  // ========================================
  // 5. BANDINGKAN TERHADAP BASELINE & SIMPAN KE pattern_insights
  // ========================================
  console.log('📊 Menyimpan hasil ke pattern_insights...\n');

  const catMap = new Map<string, CategoryRow>();
  for (const cat of categories as CategoryRow[]) {
    catMap.set(cat.id, cat);
  }

  // Bersihkan data lama dulu (atau upsert)
  // Kita pakai delete-all + insert biar clean
  console.log('  🧹 Membersihkan data pattern_insights lama...');
  const { error: delError } = await supabase.from('pattern_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.error('  ❌ Gagal membersihkan pattern_insights:', delError.message);
    // Lanjut aja, mungkin ada data baru tetap masuk
  } else {
    console.log('  ✅ Data lama dibersihkan.\n');
  }

  const insightsToInsert: Array<{
    category_id: string;
    pattern_key: string;
    pattern_value: string;
    avg_view_count: number;
    sample_count: number;
    low_confidence: boolean;
  }> = [];

  for (const [groupKey, stats] of groupMap) {
    const parts = groupKey.split('|');
    const catId = parts[0];
    const patternKey = parts[1];
    const patternValue = parts[2];

    const category = catMap.get(catId);
    const catSlug = category?.slug ?? 'unknown';

    const baseline = categoryBaselines.get(catId);
    const baselineAvg = baseline?.avg ?? 0;

    const ratio = baselineAvg > 0 ? (stats.avg_view_count / baselineAvg) : 0;
    const isAboveAverage = stats.avg_view_count > baselineAvg;

    const lowConfidence = stats.sample_count < 5;

    insightsToInsert.push({
      category_id: catId,
      pattern_key: patternKey,
      pattern_value: patternValue,
      avg_view_count: Math.round(stats.avg_view_count),
      sample_count: stats.sample_count,
      low_confidence: lowConfidence,
    });

    // Console output untuk insight
    const direction = isAboveAverage ? '⬆️ DI ATAS' : '⬇️ DI BAWAH';
    const confidenceTag = lowConfidence ? ' ⚠️ LOW CONFIDENCE' : '';
    console.log(
      `  ${catSlug.padEnd(12)} | ${patternKey.padEnd(20)} = ${patternValue.padEnd(12)} | ` +
      `avg ${Math.round(stats.avg_view_count).toLocaleString().padStart(10)} views | ` +
      `n=${String(stats.sample_count).padStart(4)} | ` +
      `${ratio.toFixed(2)}x baseline | ${direction}${confidenceTag}`
    );
  }

  // Batch insert
  if (insightsToInsert.length > 0) {
    // Split jadi batch of 100 biar ga overload
    const BATCH_SIZE = 100;
    for (let i = 0; i < insightsToInsert.length; i += BATCH_SIZE) {
      const batch = insightsToInsert.slice(i, i + BATCH_SIZE);
      const { error: insError } = await supabase
        .from('pattern_insights')
        .insert(batch);

      if (insError) {
        console.error(`❌ Gagal insert batch ${i / BATCH_SIZE + 1}:`, insError.message);
      } else {
        console.log(`  ✅ Batch ${i / BATCH_SIZE + 1} inserted (${batch.length} rows)`);
      }
    }
  }

  console.log(`\n🎉 Selesai! ${insightsToInsert.length} insight disimpan ke pattern_insights.`);

  // ========================================
  // 6. RINGKASAN — Pattern TOP per kategori
  // ========================================
  console.log('\n' + '='.repeat(70));
  console.log('📈 RINGKASAN — Pattern dengan performa TERBAIK per kategori:');
  console.log('='.repeat(70));

  // Kelompokkan insight per kategori
  const byCategory = new Map<string, typeof insightsToInsert>();
  for (const ins of insightsToInsert) {
    if (!byCategory.has(ins.category_id)) {
      byCategory.set(ins.category_id, []);
    }
    byCategory.get(ins.category_id)!.push(ins);
  }

  for (const [catId, insights] of byCategory) {
    const category = catMap.get(catId);
    const catSlug = category?.slug ?? 'unknown';
    const catName = category?.name ?? 'unknown';
    const baseline = categoryBaselines.get(catId);
    const baselineAvg = Math.round(baseline?.avg ?? 0);

    console.log(`\n📂 ${catName} (${catSlug}) — baseline avg: ${baselineAvg.toLocaleString()} views`);

    // Cari top pattern berdasarkan rasio tertinggi
    const sorted = [...insights]
      .filter(ins => !ins.low_confidence)
      .sort((a, b) => {
        const ratioA = baselineAvg > 0 ? a.avg_view_count / baselineAvg : 0;
        const ratioB = baselineAvg > 0 ? b.avg_view_count / baselineAvg : 0;
        return ratioB - ratioA;
      })
      .slice(0, 5);

    if (sorted.length === 0) {
      console.log('   (tidak ada pattern dengan confidence tinggi)');
    } else {
      for (const ins of sorted) {
        const ratio = baselineAvg > 0 ? (ins.avg_view_count / baselineAvg) : 0;
        console.log(
          `   ✅ ${ins.pattern_key}=${ins.pattern_value.padEnd(12)} → ` +
          `${ins.avg_view_count.toLocaleString().padStart(10)} views ` +
          `(${(ratio).toFixed(2)}x lipat dari rata-rata) ` +
          `n=${ins.sample_count}`
        );
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});