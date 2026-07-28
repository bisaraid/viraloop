/**
 * Script: Tag Patterns — Update semua content_samples dengan pattern_tags
 *
 * Cara pakai:
 *   npx tsx --env-file=.env scripts/tag-patterns.ts
 *
 * Script ini akan:
 * 1. Ambil semua content_samples
 * 2. Jalankan tagPattern() untuk setiap sample (pure regex/rule, no AI)
 * 3. Update kolom pattern_tags di database
 */

import { createServiceRoleClient } from '../src/lib/supabase/service';
import { tagPattern } from '../src/lib/pattern';

interface ContentSample {
  id: string;
  title: string;
  duration_seconds: number | null;
  pattern_tags: unknown;
}

async function main() {
  const supabase = createServiceRoleClient();

  console.log('📡 Mengambil content_samples...');

  const { data: samples, error } = await supabase
    .from('content_samples')
    .select('id, title, duration_seconds, pattern_tags')
    .order('captured_at', { ascending: false });

  if (error) {
    console.error('❌ Gagal mengambil content_samples:', error.message);
    process.exit(1);
  }

  if (!samples || samples.length === 0) {
    console.log('📭 Tidak ada content_samples untuk di-tag.');
    process.exit(0);
  }

  console.log(`✅ Ditemukan ${samples.length} content_samples.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Debug: cek karakter pertama yang diduga '?' di title "TAKUT SAMA AYAHNYA"
  const debugSample = samples.find((s: ContentSample) =>
    (s as ContentSample).title.toLowerCase().includes('takut sama ayah')
  ) as ContentSample | undefined;
  if (debugSample) {
    const title = debugSample.title;
    console.log('\n🔍 DEBUG title TAKUT SAMA AYAHNYA:');
    console.log('  title:', JSON.stringify(title));
    console.log('  includes("?"):', title.includes('?'));
    console.log('  regex test:', /[\u003F\uFF1F\u061F]/.test(title));
    // Cari posisi karakter yang mirip '?'
    for (let i = 0; i < title.length; i++) {
      const code = title.charCodeAt(i);
      if (code === 0x3F || code === 0xFF1F || code === 0x61F || code > 127) {
        console.log(`  pos ${i}: char ${JSON.stringify(title[i])} U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
      }
    }
    // Test tagPattern langsung
    const debugResult = tagPattern({ title: debugSample.title, duration_seconds: debugSample.duration_seconds });
    console.log('  tagPattern result:', JSON.stringify(debugResult));
    console.log('');
  }

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] as ContentSample;
    const tags = tagPattern({
      title: sample.title,
      duration_seconds: sample.duration_seconds,
    });

    // Update semua row (force recompute, bypass cache)

    // Update individual row
    const { error: updateError } = await supabase
      .from('content_samples')
      .update({ pattern_tags: tags })
      .eq('id', sample.id);

    if (updateError) {
      console.error(`❌ [${i + 1}/${samples.length}] Gagal update ${sample.id}: ${updateError.message}`);
      errorCount++;
    } else {
      updatedCount++;
    }

    // Progress log tiap 50 baris
    if ((i + 1) % 50 === 0) {
      console.log(`  📊 Progress: ${i + 1}/${samples.length} (${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors)`);
    }
  }

  console.log(`\n🎉 Selesai!`);
  console.log(`   - Total: ${samples.length}`);
  console.log(`   - Di-update: ${updatedCount}`);
  console.log(`   - Skipped (sama): ${skippedCount}`);
  console.log(`   - Error: ${errorCount}`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});