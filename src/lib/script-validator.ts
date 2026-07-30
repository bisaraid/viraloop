import { Scene, CategoryConfig, AffiliateInput } from '@/lib/types';

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Synonym mapping for mood fallback
 */
const moodSynonyms: Record<string, string> = {
  seram: 'mencekam',
  menakutkan: 'mencekam',
  horor: 'mencekam',
  horror: 'mencekam',
  menyeramkan: 'mencekam',
  senang: 'terang',
  ceria: 'terang',
  gembira: 'terang',
  bahagia: 'hangat',
  muram: 'gelap',
  suram: 'gelap',
  kelam: 'gelap',
  hening: 'sunyi',
  sepi: 'sunyi',
  tenang: 'netral',
  biasa: 'netral',
  netral: 'netral',
  kaget: 'shock',
  terkejut: 'shock',
  terkesima: 'shock',
  haru: 'sedih',
  pilu: 'sedih',
  kecewa: 'sedih',
  rindu: 'rindu',
  kangen: 'rindu',
  lega: 'lega',
  plong: 'lega',
  semangat: 'semangat',
  bersemangat: 'semangat',
  antusias: 'semangat',
  reflektif: 'reflektif',
  kontemplatif: 'reflektif',
  hangat: 'hangat',
  intim: 'hangat',
  misterius: 'misterius',
  aneh: 'misterius',
  intens: 'intens',
  tegang: 'intens',
  menegangkan: 'intens',
  fakta: 'fakta',
  informatif: 'fakta',
  edukatif: 'fakta',
  cerah: 'terang',
  sedih: 'sedih',
};

/**
 * Validates and corrects a single scene's mood to match valid moods list
 */
export function validateSceneMood(sceneMood: string, validMoods: string[], defaultMood?: string): string {
  const cleanMood = sceneMood.toLowerCase().trim();

  // Exact match
  if (validMoods.includes(cleanMood)) return cleanMood;

  // Synonym mapping (dicek SEBELUM fuzzy match, karena sinonim eksak
  // lebih penting daripada koreksi typo yang mungkin salah arah)
  if (moodSynonyms[cleanMood]) {
    const mapped = moodSynonyms[cleanMood];
    if (validMoods.includes(mapped)) return mapped;
  }

  // Fuzzy match with Levenshtein distance (tolerance for typos)
  const closest = validMoods.reduce<{ mood: string; score: number }>(
    (best, mood) => {
      const score = levenshteinDistance(cleanMood, mood.toLowerCase());
      return score < best.score ? { mood, score } : best;
    },
    { mood: validMoods[0], score: Infinity }
  );

  if (closest.score <= 3) return closest.mood;

  // Fallback to default or first valid mood
  return defaultMood ?? validMoods[0];
}

/**
 * Validates all scenes in a script against the category's valid moods
 */
export function validateScriptScenes(scenes: Scene[], config: CategoryConfig): Scene[] {
  return scenes.map((scene) => ({
    ...scene,
    scene_mood: validateSceneMood(scene.scene_mood, config.validMoods as string[], config.validMoods[0] as string),
  }));
}

/**
 * Parse JSON from Groq response - handles both json_object and text mode responses
 */
export function parseScriptJson(rawContent: string): { scenes: Scene[] } | null {
  try {
    // Try direct parse
    const parsed = JSON.parse(rawContent);
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      return parsed;
    }
    return null;
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }
    // Try to find { "scenes": [...] } pattern anywhere in text
    const scenesMatch = rawContent.match(/\{(?:\s*|[\s\S]*?)"scenes"(?:\s*|[\s\S]*?)\[[\s\S]*?\]\}/);
    if (scenesMatch) {
      try {
        return JSON.parse(scenesMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Content validation per category
 */
const AFFILIATE_DATA_PATTERNS = [
  /\bRp\b/i,
  /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\b/,
  /%|persen/i,
  /\bkali\b/i,
  /\brating\b/i,
  /\bharga\b/i,
  /\bdiskon\b/i,
  /\bspesifikasi\b/i,
];

const HORROR_SENSORY_WORDS = [
  'suara', 'bau', 'scent', 'bau', 'suhu', 'dingin', 'getaran', 'sentuh', 'rasa', 'hembusan', 'berdengkur',
  'kuat', 'lembut', 'menghantui', 'mengerikan', 'menakutkan', 'keremangan', 'keramaian', 'sunyi', 'sepi',
  'derit', 'rentak', 'detak', 'jantung', 'napas', 'bergerak', 'menggigil', 'dingin'
];

const DIALOG_PATTERN = /[""「」‘’“”]/;

export function validateContentRules(scenes: Scene[], categoryId: string): { valid: boolean; flaggedSceneIndices: number[] } {
  const flagged: number[] = [];
  if (categoryId === 'affiliate') {
    for (let i = 0; i < scenes.length; i++) {
      const text = `${scenes[i].narration} ${scenes[i].image_prompt}`;
      const hasData = AFFILIATE_DATA_PATTERNS.some(p => p.test(text));
      if (!hasData) flagged.push(i);
    }
    return { valid: flagged.length === 0, flaggedSceneIndices: flagged };
  }
  if (categoryId === 'horror') {
    for (let i = 0; i < scenes.length; i++) {
      const text = `${scenes[i].narration} ${scenes[i].image_prompt}`;
      const hasSensory = HORROR_SENSORY_WORDS.some(w => text.toLowerCase().includes(w));
      if (!hasSensory) flagged.push(i);
    }
    return { valid: flagged.length === 0, flaggedSceneIndices: flagged };
  }
  if (categoryId === 'romance') {
    for (let i = 0; i < scenes.length; i++) {
      const text = `${scenes[i].narration} ${scenes[i].image_prompt}`;
      const hasDialog = DIALOG_PATTERN.test(text);
      if (!hasDialog) flagged.push(i);
    }
    return { valid: flagged.length === 0, flaggedSceneIndices: flagged };
  }
  return { valid: true, flaggedSceneIndices: [] };
}

/**
 * Frasa generic kosong yang menandakan closing tidak bermakna.
 * Deteksi: jika narasi diawali frasa ini dan sisa setelahnya tidak mengandung
 * elemen konkret (angka, kata kerja aksi, rekomendasi), maka dianggap generic.
 */
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

/**
 * Pola elemen konkret yang menandakan closing punya substansi:
 * - Angka (Rp, %, nominal, tahun)
 * - Kata kerja aksi imperatif (coba, lakukan, mulai, gunakan, ikuti, buat, ambil, pilih)
 * - Rekomendasi spesifik (link, follow, subscribe, cek, klik, kunjungi)
 * - Kata tanya cliffhanger yang menunjukkan kelanjutan (apa, bagaimana, kenapa, siapa)
 */
const CONCRETE_ELEMENTS = [
  /\d+/,           // angka
  /\brp\b/i,       // rupiah
  /\b%\b/,         // persen
  /\bcoba\b/i,     // kata kerja aksi
  /\blakukan\b/i,
  /\bmulai\b/i,
  /\bgunakan\b/i,
  /\bikuti\b/i,
  /\bbuat\b/i,
  /\bambil\b/i,
  /\bpilih\b/i,
  /\btunggu\b/i,
  /\bfollow\b/i,   // follow hook
  /\bsubscribe\b/i,
  /\bcek\b/i,
  /\blink\b/i,
  /\bapa\b/i,      // kata tanya cliffhanger
  /\bkenapa\b/i,
  /\bbagaimana\b/i,
  /\bsiapa\b/i,
];

/**
 * Validasi scene closing (scene terakhir yang ditandai is_conclusion).
 * Mengecek:
 * 1. Scene terakhir punya is_conclusion=true
 * 2. Narasi tidak kosong/generic (minimal 30 karakter + mengandung elemen konkret)
 *
 * Heuristik generic detection:
 * - Jika narasi DIAWALI frasa generic (EMPTY_CLOSING_PHRASES), maka sisa setelah
 *   frasa tersebut HARUS mengandung minimal 1 elemen konkret (angka, kata kerja aksi,
 *   rekomendasi, atau kata tanya cliffhanger).
 * - Threshold panjang sisa TIDAK digunakan karena mudah dieksploitasi dengan
 *   menambahkan kalimat pengisi tanpa substansi (misal "itulah tadi cerita tentang
 *   fenomena ini" — panjang >10 karakter tapi tetap generic secara makna).
 * - Sebaliknya, deteksi elemen konkret memastikan closing benar-benar mengandung
 *   takeaway actionable atau cliffhanger yang bermakna.
 */
export function validateClosingScene(scenes: Scene[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (scenes.length === 0) {
    return { valid: false, errors: ['Tidak ada scene sama sekali'] };
  }

  const lastScene = scenes[scenes.length - 1];

  // Cek is_conclusion
  if (!lastScene.is_conclusion) {
    errors.push('Scene terakhir tidak ditandai is_conclusion=true');
  }

  // Cek narasi tidak kosong
  const narration = (lastScene.narration || '').trim();
  if (narration.length === 0) {
    errors.push('Scene closing memiliki narasi kosong');
    return { valid: errors.length === 0, errors };
  }

  // Cek minimal panjang karakter (30 karakter)
  if (narration.length < 30) {
    errors.push(`Scene closing terlalu pendek (${narration.length} karakter, minimal 30)`);
  }

  // Cek apakah narasi diawali frasa generic dan tidak mengandung elemen konkret
  const lowerNarration = narration.toLowerCase();
  const trimmed = lowerNarration.replace(/[^a-z\s]/g, '').trim();

  const startsWithGeneric = EMPTY_CLOSING_PHRASES.some(phrase => {
    return trimmed === phrase || trimmed.startsWith(phrase);
  });

  if (startsWithGeneric) {
    // Jika diawali frasa generic, cek apakah sisa mengandung elemen konkret
    const hasConcrete = CONCRETE_ELEMENTS.some(pattern => pattern.test(narration));
    if (!hasConcrete) {
      errors.push('Scene closing diawali frasa generic tanpa elemen konkret (angka/aksi/rekomendasi)');
    }
  }

  return { valid: errors.length === 0, errors };
}

/* validation failure counters (module-level) */
export const validationFailureCounters: Record<string, number> = {};

/**
 * Hasil validasi faktualitas affiliate.
 */
export interface AffiliateFactualityResult {
  valid: boolean;
  flags: Array<{
    sceneIndex: number;
    text: string;
    reason: string;
    type: 'unverified_stat' | 'unverified_certification' | 'superlative';
  }>;
}

/**
 * Pola angka persentase — misal "95%", "100%", "3.5%"
 */
const PERCENTAGE_PATTERN = /\b\d+(?:[.,]\d+)?\s*%/;

/**
 * Pola kata kunci sertifikasi/klaim resmi
 */
const CERTIFICATION_KEYWORDS = /\b(BPOM|halal|ISO\s*\d+|SNI|teruji\s*klinis|terdaftar\s*(?:di\s*)?BPOM|bersertifikat|tersertifikasi)\b/i;

/**
 * Pola superlatif tak terverifikasi
 */
const SUPERLATIVE_PATTERNS = [
  /\bnomor\s*1\b/i,
  /\b(?:nomor\s*)?satu\s*(?:di|se)\b/i,
  /\bterlaris\b/i,
  /\bterbaik\s*(?:se|di)\b/i,
  /\bpaling\s+(?:laku|laris|baik|populer|diminati)\b/i,
  /\bno\.?\s*1\b/i,
  /\btop\s*(?:satu|1)\b/i,
  /\bbest\s*seller\b/i,
  /\bmost\s+popular\b/i,
];

/**
 * Ekstrak semua angka persentase dari teks.
 */
function extractPercentages(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(PERCENTAGE_PATTERN.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

/**
 * Cek apakah sebuah string persentase muncul di input produk.
 * Contoh: "95%" di output → cek apakah "95%" atau "95 persen" ada di input.
 */
function percentageExistsInInput(percentage: string, inputText: string): boolean {
  const numPart = percentage.replace(/\s*%/, '').trim();
  // Cek exact match: "95%"
  if (inputText.includes(percentage)) return true;
  // Cek "95 persen"
  if (inputText.includes(`${numPart} persen`)) return true;
  // Cek "95%" tanpa spasi
  if (inputText.includes(`${numPart}%`)) return true;
  return false;
}

/**
 * Validasi pasca-generate untuk deteksi klaim mencurigakan di script affiliate.
 * Heuristik berbasis regex/keyword — cepat, tanpa biaya API tambahan.
 *
 * Mendeteksi:
 * 1. Angka persentase yang tidak ada di input produk
 * 2. Kata kunci sertifikasi (BPOM, halal, ISO, SNI, teruji klinis) yang tidak ada di input
 * 3. Superlatif tak terverifikasi (nomor 1, terlaris, terbaik se-Indonesia)
 *
 * @param scenes - Scene hasil generate
 * @param affiliateInput - Input affiliate (single product atau comparison)
 * @returns AffiliateFactualityResult — tidak throw, hanya log
 */
export function validateAffiliateFactuality(
  scenes: Scene[],
  affiliateInput: AffiliateInput
): AffiliateFactualityResult {
  const flags: AffiliateFactualityResult['flags'] = [];

  // Gabung semua teks input produk untuk referensi
  const inputTexts: string[] = [affiliateInput.productDescription];
  if (affiliateInput.comparisonProducts) {
    affiliateInput.comparisonProducts.forEach(p => inputTexts.push(p.productDescription));
  }
  const combinedInput = inputTexts.join(' ').toLowerCase();

  for (let i = 0; i < scenes.length; i++) {
    const narration = scenes[i].narration;

    // 1. Deteksi angka persentase yang tidak ada di input
    const percentages = extractPercentages(narration);
    for (const pct of percentages) {
      if (!percentageExistsInInput(pct, combinedInput)) {
        flags.push({
          sceneIndex: i,
          text: pct,
          reason: `Angka persentase "${pct}" tidak ditemukan di input produk — kemungkinan halusinasi statistik`,
          type: 'unverified_stat',
        });
      }
    }

    // 2. Deteksi kata kunci sertifikasi yang tidak ada di input (loop semua match)
    const certRegex = new RegExp(CERTIFICATION_KEYWORDS.source, 'gi');
    let certMatch: RegExpExecArray | null;
    while ((certMatch = certRegex.exec(narration)) !== null) {
      const certWord = certMatch[0].toLowerCase();
      if (!combinedInput.includes(certWord)) {
        flags.push({
          sceneIndex: i,
          text: certMatch[0],
          reason: `Klaim sertifikasi "${certMatch[0]}" tidak disebutkan di input produk`,
          type: 'unverified_certification',
        });
      }
    }

    // 3. Deteksi superlatif tak terverifikasi
    for (const pattern of SUPERLATIVE_PATTERNS) {
      const superMatch = narration.match(pattern);
      if (superMatch) {
        const superWord = superMatch[0].toLowerCase();
        if (!combinedInput.includes(superWord)) {
          flags.push({
            sceneIndex: i,
            text: superMatch[0],
            reason: `Superlatif tak terverifikasi "${superMatch[0]}" — tidak ada di input produk`,
            type: 'superlative',
          });
        }
      }
    }
  }

  return { valid: flags.length === 0, flags };
}
