/**
 * Debug script: Cek raw data edukasi dengan duration_bucket = '0-15s'
 * untuk memverifikasi apakah avg 3.456 views itu data asli atau bug.
 */
import { createServiceRoleClient } from '../lib/supabase/service';

async function main() {
  const supabase = createServiceRoleClient();

  // Cari category_id untuk 'edukasi'
  const { data: catData, error: catError } = await supabase
    .from('content_categories')
    .select('id')
    .eq('slug', 'edukasi')
    .single();

  if (catError || !catData) {
    console.error('❌ Gagal mencari kategori edukasi:', catError?.message);
    process.exit(1);
  }

  const edukasiCategoryId = catData.id;

  const { data, error } = await supabase
    .from('content_samples')
    .select('title, view_count, duration_seconds, pattern_tags')
    .eq('category_id', edukasiCategoryId)
    .not('pattern_tags', 'is', null)
    .filter('pattern_tags->>duration_bucket', 'eq', '0-15s');

  if (error) {
    console.error('❌ Query error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('📭 Tidak ada data edukasi dengan duration_bucket=0-15s');
    process.exit(0);
  }

  console.log(`\n📊 Ditemukan ${data.length} video edukasi dengan duration_bucket=0-15s:\n`);
  console.log('='.repeat(80));
  console.log('  # | Title (truncated)'.padEnd(50) + ' | views'.padStart(12) + ' | dur_sec'.padStart(8) + ' | pattern_tags');
  console.log('='.repeat(80));

  let totalViews = 0;
  let countWithViews = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as any;
    const title = (row.title ?? '(null)').substring(0, 45).padEnd(45);
    const views = row.view_count;
    const dur = row.duration_seconds;
    const tags = JSON.stringify(row.pattern_tags);

    console.log(`  ${String(i + 1).padStart(2)} | ${title} | ${String(views ?? 'NULL').padStart(10)} | ${String(dur ?? 'NULL').padStart(6)} | ${tags}`);

    if (views !== null) {
      totalViews += views;
      countWithViews++;
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📈 Statistik:`);
  console.log(`   Total samples: ${data.length}`);
  console.log(`   Samples dengan view_count: ${countWithViews}`);
  console.log(`   Total views: ${totalViews.toLocaleString()}`);
  console.log(`   Rata-rata: ${countWithViews > 0 ? Math.round(totalViews / countWithViews).toLocaleString() : 'N/A'}`);

  // Cek apakah ada yang view_count = 0 atau null
  const nullViews = data.filter((r: any) => r.view_count === null);
  const zeroViews = data.filter((r: any) => r.view_count === 0);
  console.log(`   View_count IS NULL: ${nullViews.length}`);
  console.log(`   View_count = 0: ${zeroViews.length}`);

  if (nullViews.length > 0) {
    console.log('\n⚠️  Samples dengan view_count NULL:');
    for (const r of nullViews as any[]) {
      console.log(`   - "${(r.title ?? '').substring(0, 60)}" | dur=${r.duration_seconds}`);
    }
  }
}

main().catch(console.error);