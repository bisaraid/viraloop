/**
 * Simulasi Anti-Repeat Hook Selection
 * 
 * Membuktikan bahwa selectHookWithAntiRepeat() tidak memilih
 * patternValue yang sama persis dalam 4x generate berturut-turut
 * untuk identity_key + category yang sama.
 * 
 * Jalankan: npx ts-node test-anti-repeat-sim.ts
 */

import { detectHookType } from '@/lib/pattern';

// ============================================================
// MOCK: replika fungsi selectHookWithAntiRepeat + recordUsage
// (tanpa dependency ke Supabase)
// ============================================================

interface HookEntry {
  text: string;
  patternValue: string;
}

/**
 * Replika selectHookWithAntiRepeat dari usage-history.ts
 */
function selectHookWithAntiRepeat<T extends { patternValue: string }>(
  entries: T[],
  usedPatternValues: Set<string>
): T {
  if (entries.length === 0) {
    throw new Error('entries kosong');
  }

  const unused = entries.filter(entry => !usedPatternValues.has(entry.patternValue));

  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)];
  }

  console.warn(`[FALLBACK] Semua ${usedPatternValues.size} patternValue sudah dipakai. Pilih random dari ${entries.length} entries.`);
  return entries[Math.floor(Math.random() * entries.length)];
}

// ============================================================
// SIMULASI: Psychology category (5 static hooks)
// ============================================================

// Static hookAngles dari psychology.ts — 5 entries
const staticHookTexts = [
  'Tau nggak sih? [angka]% orang mengalami [fenomena psikologi] tanpa sadar',
  'Studi Harvard reveals: [temuan mengejutkan tentang perilaku manusia]',
  'Mengapa kita [pola pikir irasional]? Psikolog punya jawabannya',
  'Fenomena psikologi yang memengaruhi keputusanmu setiap hari',
  'Bias kognitif yang bikin kamu salah ambil keputusan',
];

// Deteksi patternValue untuk setiap static hook
const staticHookEntries: HookEntry[] = staticHookTexts.map(text => ({
  text,
  patternValue: detectHookType(text),
}));

console.log('=== STATIC HOOK ENTRIES (psychology) ===');
staticHookEntries.forEach((h, i) => {
  console.log(`  [${i}] patternValue="${h.patternValue}" | text="${h.text.substring(0, 50)}..."`);
});

// Dynamic hooks (mock — seolah dari getTopHooks)
const dynamicHookEntries: HookEntry[] = [
  { text: '[1.2M views] Hook berupa pertanyaan yang langsung bikin penasaran', patternValue: 'pertanyaan' },
  { text: '[890K views] Hook diawali angka — pola terbukti menarik perhatian', patternValue: 'angka' },
];

// Gabung pool
const hookPool: HookEntry[] = [...staticHookEntries, ...dynamicHookEntries];

console.log('\n=== HOOK POOL (static + dynamic) ===');
hookPool.forEach((h, i) => {
  console.log(`  [${i}] patternValue="${h.patternValue}"`);
});

// Hitung unique patternValues
const uniquePatterns = new Set(hookPool.map(h => h.patternValue));
console.log(`\nUnique patternValues in pool: ${uniquePatterns.size} (${[...uniquePatterns].join(', ')})`);

// ============================================================
// SIMULASI: 4x generate berturut-turut
// ============================================================

const identityKey = 'anon:127.0.0.1';
const categoryId = 'psikologi';
const topic = 'Mengapa kita suka menunda pekerjaan';

// Simulasi usage_history — makin lama makin banyak record
const simulatedUsageHistory: string[] = [];

console.log('\n========================================');
console.log('SIMULASI 4x GENERATE BERTURUT-TURUT');
console.log(`identity_key: ${identityKey}`);
console.log(`category_id: ${categoryId}`);
console.log(`topic: "${topic}"`);
console.log('========================================\n');

for (let gen = 1; gen <= 4; gen++) {
  // Step 1: Query usage_history → dapatkan set patternValue yang sudah dipakai
  const usedPatternValues = new Set(simulatedUsageHistory);
  
  console.log(`--- Generate #${gen} ---`);
  console.log(`  Used patternValues before: ${usedPatternValues.size > 0 ? [...usedPatternValues].join(', ') : '(none)'}`);

  // Step 2: Pilih hook dengan anti-repeat
  const selected = selectHookWithAntiRepeat(hookPool, usedPatternValues);
  
  console.log(`  Selected: patternValue="${selected.patternValue}"`);
  console.log(`  Text: "${selected.text.substring(0, 60)}..."`);

  // Step 3: Record ke usage_history
  simulatedUsageHistory.push(selected.patternValue);
  console.log(`  Usage history now: [${simulatedUsageHistory.join(', ')}]`);
  console.log('');
}

// ============================================================
// VERIFIKASI
// ============================================================

console.log('========================================');
console.log('VERIFIKASI');
console.log('========================================');

// Cek apakah ada patternValue yang sama persis berurutan
const selections = simulatedUsageHistory;
let allUnique = true;
for (let i = 0; i < selections.length; i++) {
  for (let j = i + 1; j < selections.length; j++) {
    if (selections[i] === selections[j]) {
      // Ini OK kalau sudah fallback (setelah semua opsi habis)
      const uniqueCount = new Set(selections.slice(0, j)).size;
      if (uniqueCount < uniquePatterns.size) {
        console.log(`❌ Pengulangan sebelum opsi habis: generate #${i+1} dan #${j+1} sama-sama "${selections[i]}"`);
        allUnique = false;
      } else {
        console.log(`⚠️  Pengulangan di generate #${j+1} (pattern="${selections[j]}") — OK, karena semua ${uniquePatterns.size} opsi sudah habis. Ini fallback.`);
      }
    }
  }
}

if (allUnique) {
  console.log('✅ Tidak ada pengulangan patternValue — semua generate unik!');
}

console.log(`\nFinal usage_history: [${selections.join(', ')}]`);
console.log(`Unique patternValues used: ${new Set(selections).size} dari ${uniquePatterns.size} total opsi`);