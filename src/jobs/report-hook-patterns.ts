/**
 * Job: Report Hook Patterns — Bandingkan hook pattern paling sering dipakai user
 * (dari script_generations) vs hook pattern dengan views tertinggi (dari pattern_insights / crawl data).
 *
 * Cara pakai:
 *   npx tsx --env-file=.env src/jobs/report-hook-patterns.ts
 *
 * Output:
 *   Laporan per kategori:
 *   - Hook pattern paling sering dipilih user (2 minggu terakhir)
 *   - Hook pattern dengan rata-rata views tertinggi dari data crawl
 *   - Perbandingan: selaras (== bagus) atau berbeda (== insight menarik)
 *
 * Guardrail:
 *   INI HANYA LAPORAN OBSERVASI — tidak ada auto-adjust scoring otomatis.
 *
 * Desain mapping:
 *   hook_pattern_used di script_generations sekarang berisi pattern_value ENUM
 *   (pertanyaan/angka/clickbait_kata/netral), bukan teks panjang.
 *   - Dynamic hook: patternValue langsung dari pattern_insights (pasti akurat)
 *   - Static hook: patternValue dideteksi via detectHookType() sekali di build time
 *   Jadi report ini tinggal compare enum langsung, tanpa keyword-guessing.
 */

import { createServiceRoleClient } from '../lib/supabase/service';

// ============================================================
// TIPE DATA
// ============================================================

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

interface RawScriptGeneration {
  hook_pattern_used: string | null;
  category_id: string;
}

interface PatternInsightRow {
  pattern_key: string;
  pattern_value: string;
  avg_view_count: number;
  sample_count: number;
  low_confidence: boolean;
}

// ============================================================
// HELPERS
// ============================================================

/** Label yang lebih ramah untuk ditampilkan */
function formatPatternLabel(value: string): string {
  switch (value) {
    case 'pertanyaan': return '❓ Pertanyaan';
    case 'angka': return '🔢 Angka';
    case 'clickbait_kata': return '🔥 Clickbait';
    case 'netral': return '➖ Netral';
    default: return `❓ ${value}`;
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('📊 Hook Pattern Report — User Preference vs Crawl Data\n');
  console.log('Membandingkan hook pattern yang paling sering dipakai user');
  console.log('(dari script_generations 2 minggu terakhir) vs pattern dengan');
  console.log('views tertinggi dari data crawl (pattern_insights).\n');
  console.log('📌 Catatan: hook_pattern_used sekarang berisi ENUM langsung');
  console.log('   (pertanyaan/angka/clickbait_kata/netral), bukan teks panjang.');
  console.log('   Tidak ada keyword-guessing — data langsung dari source.\n');

  const supabase = createServiceRoleClient();
  const TWO_WEEKS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // ========================================
  // 1. AMBIL KATEGORI
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
  // 2. AMBIL SCRIPT GENERATIONS (2 minggu)
  // ========================================
  console.log('📡 Mengambil data script_generations (2 minggu terakhir)...');

  const { data: generations, error: genError } = await supabase
    .from('script_generations')
    .select('hook_pattern_used, category_id')
    .gte('created_at', TWO_WEEKS_AGO);

  if (genError) {
    console.error('❌ Gagal mengambil script_generations:', genError.message);
    process.exit(1);
  }

  console.log(`✅ Ditemukan ${generations?.length ?? 0} generasi dalam 2 minggu terakhir.\n`);

  // ========================================
  // 3. AMBIL PATTERN INSIGHTS
  // ========================================
  console.log('📡 Mengambil data pattern_insights...');

  const { data: insights, error: insError } = await supabase
    .from('pattern_insights')
    .select('category_id, pattern_key, pattern_value, avg_view_count, sample_count, low_confidence');

  if (insError) {
    console.error('❌ Gagal mengambil pattern_insights:', insError.message);
    process.exit(1);
  }

  console.log(`✅ Ditemukan ${insights?.length ?? 0} pattern insights.\n`);

  // ========================================
  // 4. KELOMPOKKAN DATA PER KATEGORI
  // ========================================

  // Hitung frekuensi hook_pattern_used per kategori
  // hook_pattern_used sekarang berisi ENUM langsung (pertanyaan/angka/clickbait_kata/netral)
  const userCounts = new Map<string, Map<string, number>>(); // category_id -> (patternValue -> count)

  for (const gen of generations ?? []) {
    const hook = (gen as RawScriptGeneration).hook_pattern_used;
    const catId = gen.category_id;

    if (!hook) continue;
    if (!userCounts.has(catId)) {
      userCounts.set(catId, new Map());
    }

    const catCounts = userCounts.get(catId)!;
    catCounts.set(hook, (catCounts.get(hook) ?? 0) + 1);
  }

  // Kelompokkan pattern_insights per kategori (hanya hook_type)
  const crawlPatterns = new Map<string, PatternInsightRow[]>(); // category_id -> PatternInsightRow[]

  for (const ins of insights ?? []) {
    const row = ins as PatternInsightRow;
    if (row.pattern_key !== 'hook_type') continue; // Hanya hook_type yang relevan

    if (!crawlPatterns.has(ins.category_id)) {
      crawlPatterns.set(ins.category_id, []);
    }
    crawlPatterns.get(ins.category_id)!.push(row);
  }

  // ========================================
  // 5. CETAK LAPORAN PER KATEGORI
  // ========================================
  console.log('='.repeat(80));
  console.log('📊 LAPORAN HOOK PATTERN: USER vs CRAWL');
  console.log(`Periode script_generations: 2 minggu terakhir (sejak ${TWO_WEEKS_AGO.slice(0, 10)})`);
  console.log('='.repeat(80));

  let totalCategoriesWithData = 0;

  for (const cat of categories as CategoryRow[]) {
    const catId = cat.id;
    const catSlug = cat.slug;
    const catName = cat.name;

    const catUserCounts = userCounts.get(catId);
    const catCrawlPatterns = crawlPatterns.get(catId);

    const hasUserData = catUserCounts && catUserCounts.size > 0;
    const hasCrawlData = catCrawlPatterns && catCrawlPatterns.length > 0;

    if (!hasUserData && !hasCrawlData) {
      continue; // Skip kategori tanpa data sama sekali
    }

    totalCategoriesWithData++;
    console.log(`\n📂 ${catName} (${catSlug})`);
    console.log('-'.repeat(80));

    // ===== BAGIAN A: User Preference (script_generations) =====
    console.log('\n🔵 [USER] Hook pattern paling sering dipakai (2 minggu terakhir):');
    if (!hasUserData) {
      console.log('   (belum ada data script_generations)');
    } else {
      // Sort by count descending
      const sortedUser = [...catUserCounts!.entries()]
        .sort((a, b) => b[1] - a[1]);

      const totalGen = [...catUserCounts!.values()].reduce((sum, c) => sum + c, 0);

      for (const [patternValue, count] of sortedUser) {
        const pct = ((count / totalGen) * 100).toFixed(1);
        console.log(`   ${formatPatternLabel(patternValue).padEnd(20)}: ${count.toString().padStart(3)}x (${pct.padStart(5)}%)`);
      }
    }

    // ===== BAGIAN B: Crawl Data (pattern_insights) =====
    console.log('\n🟢 [CRAWL] Hook pattern dengan rata-rata views tertinggi (pattern_insights):');
    if (!hasCrawlData) {
      console.log('   (belum ada data pattern_insights)');
    } else {
      // Sort by avg_view_count descending
      const sortedCrawl = [...catCrawlPatterns!]
        .sort((a, b) => b.avg_view_count - a.avg_view_count);

      for (const pattern of sortedCrawl) {
        const confTag = pattern.low_confidence ? ' ⚠️ LOW CONFIDENCE' : '';
        console.log(
          `   ${formatPatternLabel(pattern.pattern_value).padEnd(20)} → ` +
          `${pattern.avg_view_count.toLocaleString().padStart(10)} views avg ` +
          `(n=${pattern.sample_count})${confTag}`
        );
      }
    }

    // ===== BAGIAN C: Perbandingan =====
    console.log('\n⚖️  PERBANDINGAN (User vs Crawl):');

    if (hasUserData && hasCrawlData) {
      // Ambil top 1 user pattern (langsung enum, tanpa mapping)
      const topUserEntry = [...catUserCounts!.entries()].sort((a, b) => b[1] - a[1])[0];
      const topUserValue = topUserEntry[0];
      const topUserCount = topUserEntry[1];

      // Ambil top 1 crawl pattern
      const topCrawlEntry = [...catCrawlPatterns!].sort((a, b) => b.avg_view_count - a.avg_view_count)[0];
      const topCrawlValue = topCrawlEntry.pattern_value;
      const topCrawlViews = topCrawlEntry.avg_view_count;

      console.log(`   Top user:   ${formatPatternLabel(topUserValue)} (${topUserCount}x dipilih)`);
      console.log(`   Top crawl:  ${formatPatternLabel(topCrawlValue)} (${topCrawlViews.toLocaleString()} views avg)`);

      if (topUserValue === topCrawlValue) {
        console.log('\n   ✅ SELARAS! User cenderung memilih hook pattern yang juga');
        console.log('      terbukti performa tinggi di data crawl.');
      } else {
        console.log('\n   ⚡️ BERBEDA! User lebih sering memilih pattern berbeda');
        console.log('      dari yang performa tinggi di data crawl.');
        console.log('      → Insight menarik untuk investigasi manual.');
      }

      // Detail distribusi user
      if (catUserCounts!.size > 1) {
        console.log('\n   📋 Distribusi lengkap pattern user:');
        const total = [...catUserCounts!.values()].reduce((s, c) => s + c, 0);
        for (const [patternVal, count] of [...catUserCounts!.entries()].sort((a, b) => b[1] - a[1])) {
          const pct = ((count / total) * 100).toFixed(1);
          console.log(`      ${formatPatternLabel(patternVal).padEnd(20)}: ${count.toString().padStart(3)}x (${pct.padStart(5)}%)`);
        }
      }
    } else if (!hasUserData) {
      console.log('   (belum ada data user — tidak bisa dibandingkan)');
    } else {
      console.log('   (belum ada data crawl — tidak bisa dibandingkan)');
    }
  }

  // ========================================
  // 6. RINGKASAN GLOBAL
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('📋 RINGKASAN GLOBAL');
  console.log('='.repeat(80));

  let totalGenerations = 0;
  let totalAligned = 0;
  let totalDifferent = 0;

  for (const cat of categories as CategoryRow[]) {
    const catId = cat.id;
    const catUserCounts = userCounts.get(catId);
    const catCrawlPatterns = crawlPatterns.get(catId);

    if (!catUserCounts || !catCrawlPatterns || catCrawlPatterns.length === 0) continue;

    const catTotal = [...catUserCounts.values()].reduce((s, c) => s + c, 0);
    totalGenerations += catTotal;

    const topUserEntry = [...catUserCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!topUserEntry) continue;

    const topUserValue = topUserEntry[0];
    const topCrawlEntry = [...catCrawlPatterns].sort((a, b) => b.avg_view_count - a.avg_view_count)[0];

    if (topUserValue === topCrawlEntry?.pattern_value) {
      totalAligned += catTotal;
    } else {
      totalDifferent += catTotal;
    }
  }

  console.log(`\n   Total generasi (dengan hook_pattern_used): ${totalGenerations}`);
  if (totalGenerations > 0) {
    const alignedPct = ((totalAligned / totalGenerations) * 100).toFixed(1);
    const diffPct = ((totalDifferent / totalGenerations) * 100).toFixed(1);
    console.log(`   ✅ Selaras dengan crawl: ${totalAligned} (${alignedPct}%)`);
    console.log(`   ⚡️ Berbeda dengan crawl: ${totalDifferent} (${diffPct}%)`);
  }
  console.log(`\n   Kategori dengan data: ${totalCategoriesWithData}/${categories.length}`);

  console.log('\n' + '='.repeat(80));
  console.log('📌 Catatan:');
  console.log('  - Laporan ini bersifat observasi manual, bukan auto-adjust scoring.');
  console.log('  - hook_pattern_used sekarang berisi ENUM langsung (pertanyaan/angka/');
  console.log('    clickbait_kata/netral), bukan teks panjang — jadi perbandingan');
  console.log('    dengan pattern_insights 100% akurat tanpa keyword-guessing.');
  console.log('  - Static hookAngles: patternValue dideteksi via detectHookType()');
  console.log('    sekali di build time (script-generator.ts), bukan re-parse di report.');
  console.log('  - Dynamic hooks: patternValue langsung dari pattern_insights DB.');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});