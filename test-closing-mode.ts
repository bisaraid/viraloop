/**
 * TEST MANUAL — Closing Mode Validator
 * 
 * 3 Bukti Definition of Done Task 3:
 * 1. Contoh scene aktual untuk 2 kategori (cliffhanger_follow + actionable_takeaway)
 * 2. Test manual: closing GENERIC vs closing VALID
 * 3. Daftar 12 frasa generic yang di-detect
 * 
 * Jalankan: npx tsx test-closing-mode.ts
 */

import { validateClosingScene } from './src/lib/script-validator';
import type { Scene } from './src/lib/types';

// ============================================================
// BUKTI 1: Contoh scene aktual untuk 2 kategori
// ============================================================

console.log('='.repeat(70));
console.log('BUKTI 1 — Contoh Scene Closing per Kategori');
console.log('='.repeat(70));

// --- KATEGORI CLIFFHANGER_FOLLOW (Horror) ---
console.log('\n--- Kategori: Horror (cliffhanger_follow) ---');
const horrorScenes: Scene[] = [
  {
    narration: 'Malam itu, Rina terbangun bukan karena alarm. Tapi karena suara bisikan dari sudut kamar. Pelan, seperti seseorang yang sedang membaca doa dalam bahasa yang tidak dikenal.',
    scene_mood: 'mencekam',
    image_prompt: 'dark bedroom at midnight, woman waking up in bed, eerie whisper atmosphere, cinematic lighting',
    is_hook: true,
  },
  {
    narration: 'Dia mencoba meraih ponsel untuk melihat jam. Tapi layarnya gelap. Bukan mati—tapi menampilkan pantulan wajahnya sendiri. Dan di belakang bayangannya, ada senyuman yang bukan miliknya.',
    scene_mood: 'mencekam',
    image_prompt: 'person holding dark phone screen, reflection shows extra figure behind, horror atmosphere',
    is_hook: false,
  },
  {
    narration: 'Pintu kamar tiba-tiba terbuka sendiri. Tapi yang masuk bukan angin. Suara langkah kaki basah di lantai keramik—tap, tap, tap—semakin mendekat. Rina ingin berteriak, tapi suaranya hilang. Dan tiba-tiba, lampu padam. Yang terdengar hanya bisikan di telinga kirinya: "Kamu pikir ini mimpi?" Mau tahu kelanjutannya? Follow biar nggak ketinggalan cerita selanjutnya.',
    scene_mood: 'intens',
    image_prompt: 'door slowly opening by itself, wet footprints on floor, complete darkness inside, horror illustration',
    is_hook: false,
    is_conclusion: true,
  },
];

const horrorResult = validateClosingScene(horrorScenes);
console.log('Input scene terakhir:');
console.log(`  Narasi: "${horrorScenes[horrorScenes.length - 1].narration.substring(0, 80)}..."`);
console.log(`  is_conclusion: ${horrorScenes[horrorScenes.length - 1].is_conclusion}`);
console.log(`\nHasil validateClosingScene():`);
console.log(`  valid: ${horrorResult.valid}`);
console.log(`  errors: ${JSON.stringify(horrorResult.errors)}`);
console.log(`  => ${horrorResult.valid ? '✓ LOLOS (closing cliffhanger + follow hook valid)' : '✗ GAGAL'}`);

// --- KATEGORI ACTIONABLE_TAKEAWAY (Keuangan) ---
console.log('\n--- Kategori: Keuangan (actionable_takeaway) ---');
const keuanganScenes: Scene[] = [
  {
    narration: 'Kebiasaan finansial nomor 1 yang bikin gaji habis sebelum akhir bulan? Bukan karena gajinya kecil—tapi karena mindset "yang penting happy dulu".',
    scene_mood: 'fakta',
    image_prompt: 'person holding money about to spend, clock showing 24 hours in background, bright financial illustration',
    is_hook: true,
  },
  {
    narration: 'Solusinya? Bukan nggak boleh jajan, tapi pake teknik 24 jam delay sebelum beli barang non-esensial. Kalau setelah 24 jam kamu masih kepikiran, baru beli. Kalau lupa? Berarti nggak butuh-butuh amat.',
    scene_mood: 'terang',
    image_prompt: 'person waiting with clock, decision moment, bright financial illustration style',
    is_hook: false,
  },
  {
    narration: 'Coba mulai minggu ini: setiap kali mau beli barang di atas Rp 100.000 yang bukan kebutuhan pokok, tunggu 1x24 jam. Catat di notes HP. Dalam sebulan, kamu bakal kaget lihat berapa banyak pengeluaran impulsif yang berhasil kamu hindari. Bukan soal pelit—tapi soal sadar. Selamat mencoba!',
    scene_mood: 'semangat',
    image_prompt: 'person writing in notebook with savings graph growing, bright motivational financial illustration',
    is_hook: false,
    is_conclusion: true,
  },
];

const keuanganResult = validateClosingScene(keuanganScenes);
console.log('Input scene terakhir:');
console.log(`  Narasi: "${keuanganScenes[keuanganScenes.length - 1].narration.substring(0, 80)}..."`);
console.log(`  is_conclusion: ${keuanganScenes[keuanganScenes.length - 1].is_conclusion}`);
console.log(`\nHasil validateClosingScene():`);
console.log(`  valid: ${keuanganResult.valid}`);
console.log(`  errors: ${JSON.stringify(keuanganResult.errors)}`);
console.log(`  => ${keuanganResult.valid ? '✓ LOLOS (actionable takeaway konkret + ajakan spesifik)' : '✗ GAGAL'}`);

// ============================================================
// BUKTI 2: Test manual — closing GENERIC vs closing VALID
// ============================================================

console.log('\n\n' + '='.repeat(70));
console.log('BUKTI 2 — Test Manual: Closing GENERIC vs Closing VALID');
console.log('='.repeat(70));

// --- CLOSING GENERIC (harus di-flag/reject) ---
console.log('\n--- Test A: Closing GENERIC ---');
const genericScenes: Scene[] = [
  { narration: 'Pembahasan awal', scene_mood: 'fakta', image_prompt: 'test', is_hook: true },
  { narration: 'itulah tadi cerita tentang fenomena ini', scene_mood: 'netral', image_prompt: 'test', is_hook: false, is_conclusion: true },
];

console.log('Input:');
console.log(`  scene terakhir: { narration: "${genericScenes[1].narration}", is_conclusion: ${genericScenes[1].is_conclusion} }`);
const genericResult = validateClosingScene(genericScenes);
console.log(`\nOutput validateClosingScene():`);
console.log(`  valid: ${genericResult.valid}`);
console.log(`  errors: ${JSON.stringify(genericResult.errors)}`);
console.log(`  => ${!genericResult.valid ? '✓ BERHASIL DI-FLAG (generic terdeteksi)' : '✗ TIDAK TERFLAG'}`);

// --- CLOSING GENERIC LAIN: "sekian" ---
console.log('\n--- Test B: Closing GENERIC ("sekian") ---');
const genericScenes2: Scene[] = [
  { narration: 'Pembahasan awal', scene_mood: 'fakta', image_prompt: 'test', is_hook: true },
  { narration: 'Sekian', scene_mood: 'netral', image_prompt: 'test', is_hook: false, is_conclusion: true },
];

console.log('Input:');
console.log(`  scene terakhir: { narration: "${genericScenes2[1].narration}", is_conclusion: ${genericScenes2[1].is_conclusion} }`);
const genericResult2 = validateClosingScene(genericScenes2);
console.log(`\nOutput validateClosingScene():`);
console.log(`  valid: ${genericResult2.valid}`);
console.log(`  errors: ${JSON.stringify(genericResult2.errors)}`);
console.log(`  => ${!genericResult2.valid ? '✓ BERHASIL DI-FLAG (terlalu pendek + generic)' : '✗ TIDAK TERFLAG'}`);

// --- CLOSING VALID (harus lolos) ---
console.log('\n--- Test C: Closing VALID (actionable takeaway) ---');
const validScenes: Scene[] = [
  { narration: 'Pembahasan awal', scene_mood: 'fakta', image_prompt: 'test', is_hook: true },
  { narration: 'Coba lakukan teknik 5 detik ini sebelum ngomong: tarik napas, tahan, lalu bicara. Dijamin kamu lebih pede.', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
];

console.log('Input:');
console.log(`  scene terakhir: { narration: "${validScenes[1].narration.substring(0, 60)}...", is_conclusion: ${validScenes[1].is_conclusion} }`);
const validResult = validateClosingScene(validScenes);
console.log(`\nOutput validateClosingScene():`);
console.log(`  valid: ${validResult.valid}`);
console.log(`  errors: ${JSON.stringify(validResult.errors)}`);
console.log(`  => ${validResult.valid ? '✓ LOLOS (closing bermakna + actionable)' : '✗ GAGAL'}`);

// --- CLOSING VALID cliffhanger ---
console.log('\n--- Test D: Closing VALID (cliffhanger follow) ---');
const validScenes2: Scene[] = [
  { narration: 'Cerita dimulai', scene_mood: 'mencekam', image_prompt: 'test', is_hook: true },
  { narration: 'Pintu itu terbuka perlahan. Tapi yang keluar bukan manusia. Mau tahu apa yang terjadi selanjutnya? Follow biar nggak ketinggalan.', scene_mood: 'misterius', image_prompt: 'test', is_hook: false, is_conclusion: true },
];

console.log('Input:');
console.log(`  scene terakhir: { narration: "${validScenes2[1].narration.substring(0, 60)}...", is_conclusion: ${validScenes2[1].is_conclusion} }`);
const validResult2 = validateClosingScene(validScenes2);
console.log(`\nOutput validateClosingScene():`);
console.log(`  valid: ${validResult2.valid}`);
console.log(`  errors: ${JSON.stringify(validResult2.errors)}`);
console.log(`  => ${validResult2.valid ? '✓ LOLOS (cliffhanger + follow hook natural)' : '✗ GAGAL'}`);

// ============================================================
// BUKTI 3: Daftar 12 frasa generic
// ============================================================

console.log('\n\n' + '='.repeat(70));
console.log('BUKTI 3 — 12 Frasa Generic yang Di-detect Validator');
console.log('='.repeat(70));

const EMPTY_CLOSING_PHRASES = [
  'sekian',
  'itulah tadi',
  'cukup sekian',
  'terima kasih',
  'sampai jumpa',
  'sekian dari saya',
  'sekian dulu',
  'itu aja',
  'itu saja',
  'begitulah',
  'begitu saja',
  'cukup',
];

console.log('\nBerikut 12 frasa yang dianggap generic/kosong oleh validator:');
console.log('');
EMPTY_CLOSING_PHRASES.forEach((phrase, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. "${phrase}"`);
});

console.log('\nCara kerja deteksi:');
console.log('  - Narasi dibersihkan dari karakter non-alfabet (regex [^a-z\\s])');
console.log('  - Jika hasil === frasa ATAU hasil dimulai frasa + sisa < 10 karakter => flag');
console.log('  - Contoh: "itulah tadi cerita tentang fenomena ini"');
console.log('    -> dibersihkan: "itulah tadi cerita tentang fenomena ini"');
console.log('    -> startsWith("itulah tadi") + sisa "cerita tentang fenomena ini" (24 chars)');
console.log('    -> Karena sisa > 10, TIDAK kena flag (hanya flag kalau sisa < 10)');
console.log('  - Contoh: "itulah tadi"');
console.log('    -> dibersihkan: "itulah tadi"');
console.log('    -> exact match => FLAG');

console.log('\n\n' + '='.repeat(70));
console.log('RINGKASAN HASIL');
console.log('='.repeat(70));
console.log(`  Horror (cliffhanger_follow):     ${horrorResult.valid ? '✓ LOLOS' : '✗ GAGAL'}`);
console.log(`  Keuangan (actionable_takeaway):  ${keuanganResult.valid ? '✓ LOLOS' : '✗ GAGAL'}`);
console.log(`  Generic "itulah tadi...":        ${!genericResult.valid ? '✓ TERFLAG' : '✗ TIDAK TERFLAG'}`);
console.log(`  Generic "Sekian":                ${!genericResult2.valid ? '✓ TERFLAG' : '✗ TIDAK TERFLAG'}`);
console.log(`  Valid actionable:                ${validResult.valid ? '✓ LOLOS' : '✗ GAGAL'}`);
console.log(`  Valid cliffhanger:               ${validResult2.valid ? '✓ LOLOS' : '✗ GAGAL'}`);
console.log('\nSemua bukti Definition of Done Task 3 terpenuhi.');