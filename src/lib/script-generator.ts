import { aiCompletion } from '@/lib/ai/completion';
import { getCategoryConfig, getCustomCategoryConfig } from '@/lib/categories';
import { getDurationConfig } from '@/lib/duration';
import { parseScriptJson, validateScriptScenes, validateContentRules, validateClosingScene, validationFailureCounters } from '@/lib/script-validator';
import { Scene, CategoryId, DurationTier, AffiliateInput, GenerateScriptProgress, HookPatternType, ScriptSkeleton, CategoryConfig } from '@/lib/types';
import { getOptionalEnvVar } from '@/lib/env';
import { getTopHooks } from '@/lib/dynamicHooks';
import { detectHookType } from '@/lib/pattern';
import { fetchTrendingProduct, TrendingProduct } from '@/lib/trendtracker-client';

/**
 * Hook entry yang membawa teks hook + pattern_value (enum) sekaligus.
 * Untuk dynamic hook: patternValue dari pattern_insights (pasti akurat).
 * Untuk static hook: patternValue dideteksi via detectHookType() sekali di build time.
 */
interface HookEntry {
  text: string;
  patternValue: HookPatternType;
}

const MODEL = getOptionalEnvVar('GROQ_MODEL', 'llama-3.3-70b-versatile');

// In-memory cache dengan TTL 1 jam
const scriptCache = new Map<string, { scenes: Scene[]; failedSegment?: number; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

function getCacheKey(categoryId: CategoryId, topic: string, duration: DurationTier, affiliateInput?: AffiliateInput): string {
  const affSuffix = affiliateInput?.productDescription ? `:${affiliateInput.productDescription.slice(0, 50)}` : '';
  return `${categoryId}:${topic}:${duration}${affSuffix}`;
}

function getFromCache(key: string): { scenes: Scene[]; failedSegment?: number } | null {
  const cached = scriptCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    scriptCache.delete(key);
    return null;
  }
  return { scenes: cached.scenes, failedSegment: cached.failedSegment };
}

function setCache(key: string, data: { scenes: Scene[]; failedSegment?: number }): void {
  scriptCache.set(key, { ...data, timestamp: Date.now() });
  // Bersihkan cache jika terlalu besar (>100 entries)
  if (scriptCache.size > 100) {
    const oldest = [...scriptCache.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp)[0];
    if (oldest) scriptCache.delete(oldest[0]);
  }
}

/**
 * Ambil scriptSkeleton dari config, handle custom dengan fallback.
 */
function getScriptSkeleton(config: { scriptSkeleton?: ScriptSkeleton; usesFictionalCharacter?: boolean }): ScriptSkeleton {
  if (config.scriptSkeleton) return config.scriptSkeleton;
  // Fallback: jika tidak ada scriptSkeleton, infer dari usesFictionalCharacter
  return config.usesFictionalCharacter ? 'narrative_arc' : 'informational_arc';
}

/**
 * Resolve config: jika config diberikan langsung, pakai itu.
 * Jika tidak, fallback ke getCategoryConfig(categoryId).
 * Ini mencegah custom category menggunakan placeholder dari categoryMap.
 */
function resolveConfig(categoryId: CategoryId, config?: CategoryConfig): CategoryConfig {
  if (config) return config;
  return getCategoryConfig(categoryId);
}

/**
 * Build the system prompt for a given category.
 * Menerima config opsional — jika diberikan, dipakai langsung (tanpa via getCategoryConfig)
 * sehingga custom category tidak akan kena placeholder.
 */
function buildSystemPrompt(
  categoryId: CategoryId,
  staticHookEntries: HookEntry[],
  dynamicHookEntries: HookEntry[],
  explicitConfig?: CategoryConfig
): { prompt: string; selectedText: string | null; selectedPatternValue: HookPatternType | null } {
  const config = resolveConfig(categoryId, explicitConfig);
  const skeleton = getScriptSkeleton(config);
  const persona = config.narratorPersona;

  let prompt = `Kamu adalah penulis script video pendek bahasa Indonesia. 

PERSONA NARATOR:
Nama persona: ${persona.name}
Tone: ${persona.tone}
Irama kalimat: ${persona.sentenceRhythm}
Frasa khas yang boleh dipakai: ${persona.signaturePhrases.join(', ')}
Kata yang HARUS DIHINDARI: ${persona.avoidWords.join(', ')}

STRUKTUR KONTEN:
${config.storyStructure}

${config.rules ? `ATURAN:\n${config.rules}\n` : ''}`;

  if (config.closingMode === 'actionable_takeaway') {
    prompt += `
CLOSING WAJIB: Scene TERAKHIR dari naskah HARUS berisi SATU poin kesimpulan konkret yang bisa langsung dipraktikkan penonton. Bukan "jadi begitulah" — tapi ajakan spesifik seperti "coba lakukan X" atau "pilihan yang bisa kamu ambil adalah Y". Sampaikan tetap dalam gaya persona narator.`;
  } else if (config.closingMode === 'cliffhanger_follow') {
    prompt += `
CLOSING WAJIB: Scene TERAKHIR dari naskah HARUS meninggalkan elemen emosional yang BELUM TERSELESAIKAN — pertanyaan menggantung, ketegangan yang belum reda, atau momen yang bikin penonton penasaran. Sertakan ajakan IMPLISIT untuk follow (misalnya "ikutin cerita selanjutnya" atau "follow biar nggak ketinggalan") tanpa terdengar seperti iklan murahan. Jaga agar tetap natural dalam alur cerita.`;
  }

  // Branching: instruksi berdasarkan scriptSkeleton
  if (skeleton === 'narrative_arc') {
    prompt += `
Kategori ini MENGGUNAKAN alur CERITA FIKSI dengan karakter/tokoh. Wajib membuat tokoh dengan nama dan latar yang jelas untuk mendukung cerita. Bangun ketegangan dramatis, konflik, dan resolusi sebagaimana alur cerita pada umumnya.
`;
  } else if (skeleton === 'factual_narrative') {
    prompt += `
ATURAN WAJIB: Kategori ini adalah konten SEJARAH FAKTUAL. BOLEH menyebut tokoh SEJARAH ASLI yang benar-benar ada (seperti Gajah Mada, Hayam Wuruk, Cut Nyak Dien, dll). DILARANG KERAS mengarang KARAKTER FIKSI BARU (nama rekaan seperti "Rina", "Budi", dst yang tidak ada dalam catatan sejarah). DILARANG membuat subplot/cerita personal fiktif. Sampaikan konten berdasarkan fakta sejarah secara kronologis.
`;
  } else if (skeleton === 'informational_arc') {
    prompt += `
ATURAN WAJIB: Kategori ini adalah konten INFORMATIF/TIPS LANGSUNG, BUKAN cerita fiksi. DILARANG KERAS membuat nama karakter (seperti 'Rina', 'Budi', dst), DILARANG membuat subplot/cerita personal apapun. Sampaikan SEMUA poin secara langsung ke pemirsa menggunakan kata 'kamu' atau 'guys', TANPA tokoh perantara. Setiap segmen berdiri sendiri membahas poin baru — JANGAN membuat cliffhanger atau alur bersambung dramatis.
`;
  }

  prompt += `
MOOD VALID (hanya gunakan mood dari daftar ini):
${config.validMoods.join(', ')}

FORMAT OUTPUT (WAJIB JSON):
{
  "scenes": [
    {
      "narration": "teks narasi bahasa Indonesia",
      "scene_mood": "salah satu mood valid di atas",
      "image_prompt": "bahasa Inggris: [subjek+aksi], [ekspresi], [setting], [gaya visual]${config.styleSuffix}",
      "is_hook": false
    }
  ]
}

PENTING:
- Setiap scene harus punya scene_mood yang valid dari daftar di atas
- Scene pertama (is_hook: true) harus hook yang kuat
- image_prompt dalam bahasa Inggris, 15-25 kata
- Narasi dalam bahasa Indonesia yang natural`;

  if (config.exampleScenes && config.exampleScenes.length > 0) {
    prompt += `\n\nCONTOH REFERENSI (multiple styles — ikuti gaya masing-masing, JANGAN gabung semua gaya menjadi satu pola):`;
    config.exampleScenes.forEach((ex, i) => {
      prompt += `\n\nContoh ${i + 1}:
Narasi: ${ex.narration}
Mood: ${ex.scene_mood}`;
      if (ex.image_prompt) {
        prompt += `\nImage prompt: ${ex.image_prompt}`;
      }
    });
  }

  prompt += `\n\nATURAN PENTING UNTUK VARIASI:
Contoh di atas hanya referensi gaya dan struktur, BUKAN template yang harus ditiru persis. 
Buat hook dan kalimat dengan struktur kalimat/kata pembuka yang BERBEDA dari semua contoh di atas. 
Hindari pengulangan pola pembuka yang sama setiap generate.

JANGAN menciptakan karakter/tokoh fiksi (nama orang) kecuali contoh referensi di atas ATAU struktur cerita kategori ini secara eksplisit menggunakan karakter. Kalau tidak ada karakter di contoh, sampaikan konten secara langsung/informatif tanpa protagonis rekaan.`;

  // Gabung static + dynamic hooks, biasakan ke dynamic yang terbukti tinggi views
  const hookPool: HookEntry[] = [...staticHookEntries, ...dynamicHookEntries];

  let selectedText: string | null = null;
  let selectedPatternValue: HookPatternType | null = null;

  if (hookPool.length > 0) {
    const selected = hookPool[Math.floor(Math.random() * hookPool.length)];
    selectedText = selected.text;
    selectedPatternValue = selected.patternValue;
    prompt += `\n\nHOOK ANGLE UNTUK GENERATE INI: ${selectedText}`;

    // Kalau ada data dari crawl, kasih konteks tambahan
    if (dynamicHookEntries.length > 0) {
      const dynamicTexts = dynamicHookEntries.map(h => h.text);
      prompt += `\n\nDATA POLA HOOK TERBUKTI (dari analisis ribuan video ${categoryId}):
${dynamicTexts.join('\n')}

Gunakan insight di atas sebagai referensi gaya hook yang TERBUKTI performa. 
Namun tetap variasikan bahasa dan pendekatan agar tidak terdengar repetitif.`;
    }
  }

  return { prompt, selectedText, selectedPatternValue };
}

/**
 * Build the user prompt for segment generation
 * Menerima config opsional — jika diberikan, dipakai langsung (tanpa via getCategoryConfig)
 * sehingga custom category tidak akan kena placeholder.
 */
function buildSegmentPrompt(
  categoryId: CategoryId,
  topic: string,
  duration: DurationTier,
  segmentIndex: number,
  totalSegments: number,
  globalOutline: string,
  previousSummary: string,
  affiliateInput?: AffiliateInput,
  trendingProduct?: TrendingProduct | null,
  explicitConfig?: CategoryConfig
): string {
  const config = resolveConfig(categoryId, explicitConfig);
  const skeleton = getScriptSkeleton(config);
  const durConfig = getDurationConfig(duration);
  const scenesPerSegment = Math.ceil(durConfig.targetScenes / totalSegments);

  let prompt = '';

  // Konteks trending product dari TrendTracker (hanya untuk affiliate)
  const trendingContext = (categoryId === 'affiliate' && trendingProduct) ? `
DATA TREN PASARAN (dari TrendTracker — produk ini benar-benar sedang trending):
Nama Produk: ${trendingProduct.name}
${trendingProduct.category ? `Kategori: ${trendingProduct.category}` : ''}
${trendingProduct.description ? `Deskripsi: ${trendingProduct.description}` : ''}
${trendingProduct.price ? `Harga: ${trendingProduct.price}` : ''}
${trendingProduct.rating ? `Rating: ${trendingProduct.rating}/5` : ''}
${trendingProduct.commission_score !== undefined ? `Skor Komisi: ${trendingProduct.commission_score}` : ''}
${trendingProduct.trend_growth_score !== undefined ? `Skor Pertumbuhan Tren: ${trendingProduct.trend_growth_score}` : ''}

PENTING: Produk di atas adalah produk yang BENAR-BENAR SEDANG TRENDING di pasaran saat ini. 
Gunakan data ini sebagai referensi utama dalam review. Jangan mengarang data yang tidak ada.` : '';

  if (segmentIndex === 0) {
    // First segment: generate first scenes using the global outline
    const categoryLabel = categoryId === 'affiliate' ? 'review produk' : categoryId;
    prompt = `Buat script video ${categoryLabel} dengan topik: "${topic}"
    
OUTLINE GLOBAL:
${globalOutline}

Target: ${scenesPerSegment} scene pertama (total ${durConfig.targetScenes} scene untuk seluruh video).
Durasi: ${durConfig.label}.

${categoryId === 'affiliate' && affiliateInput ? `
DATA PRODUK (WAJIB gunakan data ini, JANGAN mengarang):
${affiliateInput.productUrl ? `URL: ${affiliateInput.productUrl}` : ''}
${affiliateInput.productDescription ? `Deskripsi: ${affiliateInput.productDescription}` : ''}
${affiliateInput.productPrice ? `Harga: Rp ${affiliateInput.productPrice}` : ''}
${affiliateInput.productRating ? `Rating: ${affiliateInput.productRating}/5` : ''}
${affiliateInput.reviews && affiliateInput.reviews.length > 0 ? `Ulasan dari internet: ${affiliateInput.reviews.join('\n')}` : ''}

${!affiliateInput.reviews || affiliateInput.reviews.length === 0 ? `
PENTING: Buat 2-3 ulasan pengguna fiktif yang REALISTIS berdasarkan fitur deskripsi dan harga produk di atas. Ulasan harus terdengar seperti pembeli sungguhan, dengan gaya bahasa Indonesia sehari-hari.` : ''}

INGAT: Hanya gunakan informasi yang ada di data di atas. Jangan tambahkan klaim atau spesifikasi yang tidak disebutkan user.` : ''}
${trendingContext}
Buat scene-scene pertama sesuai outline di atas. Scene pertama (is_hook: true) harus hook yang kuat.`;
  } else {
    // Subsequent segments: branching berdasarkan scriptSkeleton
    const startScene = segmentIndex * scenesPerSegment + 1;
    const endScene = Math.min((segmentIndex + 1) * scenesPerSegment, durConfig.targetScenes);

    if (skeleton === 'informational_arc') {
      // Untuk konten informatif: setiap segmen adalah poin/langkah baru yang berdiri sendiri
      prompt = `Lanjutkan script dengan topik: "${topic}"

OUTLINE GLOBAL:
${globalOutline}

${previousSummary ? `POIN SEBELUMNYA YANG SUDAH DIBAHAS (untuk menghindari pengulangan):\n${previousSummary}\n` : ''}

Target: ${scenesPerSegment} scene berikutnya (scene ${startScene} sampai ${endScene}).

Lanjutkan ke poin/langkah berikutnya dari outline di atas. Penting:
- Setiap segmen membahas poin BARU yang berdiri sendiri — JANGAN buat cliffhanger atau alur bersambung dramatis
- JANGAN menggunakan kata "Lanjutkan cerita" — ini BUKAN cerita, ini konten informatif
- JANGAN membuat karakter/tokoh fiksi — sampaikan langsung ke pemirsa (kamu/guys)
- Gunakan outline global sebagai panduan poin-poin yang harus dibahas
- Jangan ulangi poin yang sudah tercakup di ringkasan sebelumnya`;
    } else {
      // Untuk narrative_arc dan factual_narrative: kontinuitas alur
      const continuityInstruction = skeleton === 'factual_narrative'
        ? `Lanjutkan kronologi sejarah dari outline di atas. Pastikan:
- Kronologi waktu akurat dan berurutan
- Tokoh sejarah KONSISTEN dengan catatan sejarah
- Jangan membuat karakter fiksi baru
- Alur faktual dan kronologis, jangan membuat twist dramatis yang tidak berdasarkan fakta`
        : `Lanjutkan cerita dari outline global di atas. Pastikan:
- Karakter/tokoh KONSISTEN dengan outline
- Nama tokoh dan setting KONSISTEN
- Alur cerita nyambung logis mengikuti outline
- Mood sesuai dengan perkembangan cerita
- Jangan ulangi adegan yang sudah terjadi`;

      prompt = `Lanjutkan script dengan topik: "${topic}"

OUTLINE GLOBAL:
${globalOutline}

${previousSummary ? `RINGKASAN BAGIAN SEBELUMNYA (untuk referensi kontinuitas):\n${previousSummary}\n` : ''}

Target: ${scenesPerSegment} scene berikutnya (scene ${startScene} sampai ${endScene}).

${continuityInstruction}

PENTING: Gunakan outline global sebagai panduan utama. Ringkasan sebelumnya hanya untuk referensi kontinuitas.`;
    }
  }

  return prompt;
}

/**
 * Generate a single segment of the script
 * Menerima explicitConfig — untuk custom category, config yang sudah di-resolve
 * dengan nicheName dikirim langsung agar tidak kena placeholder.
 */
async function generateSegment(
  categoryId: CategoryId,
  topic: string,
  duration: DurationTier,
  segmentIndex: number,
  totalSegments: number,
  globalOutline: string,
  previousSummary: string,
  affiliateInput?: AffiliateInput,
  retryCount: number = 0,
  signal?: AbortSignal,
  staticHookEntries: HookEntry[] = [],
  dynamicHookEntries: HookEntry[] = [],
  trendingProduct?: TrendingProduct | null,
  explicitConfig?: CategoryConfig
): Promise<{ scenes: Scene[]; summary: string; hasValidationFlagged?: boolean; selectedText?: string | null; selectedPatternValue?: HookPatternType | null }> {
  const config = resolveConfig(categoryId, explicitConfig);
  const { prompt: systemPrompt, selectedText, selectedPatternValue } = buildSystemPrompt(categoryId, staticHookEntries, dynamicHookEntries, explicitConfig);
  const userPrompt = buildSegmentPrompt(
    categoryId, topic, duration, segmentIndex, totalSegments,
    globalOutline, previousSummary, affiliateInput, trendingProduct, explicitConfig
  );

  try {
    const result = await aiCompletion({
      model: MODEL!,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: config.temperature ?? 0.7,
      signal,
    });

    const parsed = parseScriptJson(result.content);
    if (!parsed || !parsed.scenes || parsed.scenes.length === 0) {
      throw new Error('Gagal parse JSON dari response AI');
    }

    // Validate moods
    const validatedScenes = validateScriptScenes(parsed.scenes, config);

    // Content validation (hard fallback: ga fail entire generation, cuma flagged scene)
    const contentValidation = validateContentRules(validatedScenes, categoryId);
    if (!contentValidation.valid) {
      // Log failure
      validationFailureCounters[categoryId] = (validationFailureCounters[categoryId] || 0) + 1;
      console.warn(`[Validation] Segment ${segmentIndex + 1} content validation failed for ${categoryId}:`, contentValidation.flaggedSceneIndices);

      // Retry once if under retry limit
      if (retryCount < 1) {
        const delay = 1000 * Math.pow(2, retryCount);
        console.warn(`Segment ${segmentIndex + 1} content invalid, retry ${retryCount + 1}/1 dalam ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateSegment(
          categoryId, topic, duration, segmentIndex, totalSegments,
          globalOutline, previousSummary, affiliateInput, retryCount + 1, signal,
          staticHookEntries, dynamicHookEntries, trendingProduct, explicitConfig
        );
      }

      // Hard fallback: mark scenes as flagged instead of throwing
      const flaggedScenes = validatedScenes.map((scene, idx) => ({
        ...scene,
        flagged: contentValidation.flaggedSceneIndices.includes(idx),
      }));
      const summary = generateSegmentSummary(flaggedScenes, segmentIndex);
      return { scenes: flaggedScenes, summary, hasValidationFlagged: true, selectedText, selectedPatternValue };
    }

    // Generate summary of this segment for next segment's context
    const summary = generateSegmentSummary(validatedScenes, segmentIndex);

    return { scenes: validatedScenes, summary, selectedText, selectedPatternValue };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error; // Don't retry aborted requests
    }
    if (retryCount < 2) {
      // Exponential backoff: 1s, 2s
      const delay = 1000 * Math.pow(2, retryCount);
      console.warn(`Segment ${segmentIndex + 1} gagal, retry ${retryCount + 1}/2 dalam ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateSegment(
        categoryId, topic, duration, segmentIndex, totalSegments,
        globalOutline, previousSummary, affiliateInput, retryCount + 1, signal,
        staticHookEntries, dynamicHookEntries, trendingProduct, explicitConfig
      );
    }
    throw error;
  }
}

/**
 * Generate a summary of a segment for context continuity
 */
function generateSegmentSummary(scenes: Scene[], segmentIndex: number): string {
  const narrations = scenes.map(s => s.narration).join(' ');
  const words = narrations.split(/\s+/).filter(w => w.length > 0);
  const truncated = words.slice(0, 100).join(' '); // Keep ~100 words summary
  const moods = [...new Set(scenes.map(s => s.scene_mood))];
  const hooks = scenes.filter(s => s.is_hook).length;

  return `[Segmen ${segmentIndex + 1}]: ${truncated}... [Mood: ${moods.join(', ')}] [Hook scenes: ${hooks}]`;
}

/**
 * Generate the global outline (first call before segments)
 * Menerima explicitConfig opsional — untuk custom category, config yang sudah
 * di-resolve dengan nicheName dikirim langsung agar tidak kena placeholder.
 */
async function generateOutline(
  categoryId: CategoryId,
  topic: string,
  affiliateInput?: AffiliateInput,
  signal?: AbortSignal,
  explicitConfig?: CategoryConfig
): Promise<string> {
  const config = resolveConfig(categoryId, explicitConfig);
  const skeleton = getScriptSkeleton(config);

  let prompt: string;

  if (skeleton === 'informational_arc') {
    prompt = `Buat outline 3-5 poin untuk konten ${categoryId === 'affiliate' ? 'review produk' : categoryId} dengan topik: "${topic}"

${categoryId === 'affiliate' && affiliateInput ? `
DATA PRODUK:
${affiliateInput.productDescription ? `Deskripsi: ${affiliateInput.productDescription}` : ''}
${affiliateInput.reviews && affiliateInput.reviews.length > 0 ? `Ulasan: ${affiliateInput.reviews.join('\n')}` : ''}
` : ''}

Outline harus mencakup:
- Poin-poin utama yang akan dibahas (bukan alur cerita)
- Urutan penyampaian yang logis dari yang paling penting ke pendukung
- Satu takeaway kunci yang harus didapat penonton

Format: teks biasa, 3-5 poin saja. Setiap poin dalam 1 kalimat jelas.`;
  } else if (skeleton === 'factual_narrative') {
    prompt = `Buat outline 3-5 kalimat untuk konten sejarah dengan topik: "${topic}"

${categoryId === 'affiliate' && affiliateInput ? `
DATA PRODUK:
${affiliateInput.productDescription ? `Deskripsi: ${affiliateInput.productDescription}` : ''}
${affiliateInput.reviews && affiliateInput.reviews.length > 0 ? `Ulasan: ${affiliateInput.reviews.join('\n')}` : ''}
` : ''}

Outline harus mencakup:
- Peristiwa/tokoh nyata yang akan dibahas
- Kronologi waktu yang akurat (tahun, periode)
- Dampak peristiwa tersebut ke masa kini
- Mood dominan

Format: teks biasa, 3-5 kalimat saja. Kronologis berdasarkan fakta sejarah.`;
  } else {
    // narrative_arc (default untuk horror, misteri, romance)
    prompt = `Buat outline 3-5 kalimat untuk cerita ${categoryId === 'affiliate' ? 'review produk' : categoryId} dengan topik: "${topic}"

${categoryId === 'affiliate' && affiliateInput ? `
DATA PRODUK:
${affiliateInput.productDescription ? `Deskripsi: ${affiliateInput.productDescription}` : ''}
${affiliateInput.reviews && affiliateInput.reviews.length > 0 ? `Ulasan: ${affiliateInput.reviews.join('\n')}` : ''}
` : ''}

Outline harus mencakup:
- Tokoh utama (jika ada)
- Setting/latar
- Alur dari awal sampai akhir (termasuk twist jika ada)
- Mood dominan

Format: teks biasa, 3-5 kalimat saja.`;
  }

  const systemContent = skeleton === 'informational_arc'
    ? `Kamu adalah penulis script ${config.name} Indonesia. Buat outline berupa poin-poin informatif.`
    : `Kamu adalah penulis script ${config.name} Indonesia. Buat outline singkat.`;

  const result = await aiCompletion({
    model: MODEL!,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'text' },
    temperature: config.temperature ?? 0.7,
    signal,
  });

  return result.content.trim();
}

/**
 * Main function: Generate full script with multi-segment and parallel support
 * Returns scenes with optional parallel generation for segments 2+
 */
export async function generateScript(
  categoryId: CategoryId,
  topic: string,
  duration: DurationTier,
  affiliateInput?: AffiliateInput,
  onProgress?: (progress: GenerateScriptProgress) => void,
  signal?: AbortSignal,
  nicheName?: string
): Promise<{ scenes: Scene[]; failedSegment?: number; hookPatternUsed?: string }> {
  // Cek cache — DINONAKTIFKAN untuk script generation agar setiap generate unik
  // const cacheKey = getCacheKey(categoryId, topic, duration, affiliateInput);
  // const cached = getFromCache(cacheKey);
  // if (cached) {
  //   return cached;
  // }

  const durConfig = getDurationConfig(duration);
  const totalSegments = durConfig.segments;
  const scenesPerSegment = Math.ceil(durConfig.targetScenes / totalSegments);

  try {
    // Step -1: Untuk affiliate, ambil data trending product dari TrendTracker
    let trendingProduct: TrendingProduct | null = null;
    if (categoryId === 'affiliate') {
      try {
        trendingProduct = await fetchTrendingProduct(topic);
        if (trendingProduct) {
          console.log(`[TrendTracker] Got trending product: ${trendingProduct.name} (match: "${topic}")`);
        } else {
          console.log('[TrendTracker] No trending product found for topic, will use random from top 5');
          trendingProduct = await fetchTrendingProduct(undefined);
          if (trendingProduct) {
            console.log(`[TrendTracker] Fallback random product: ${trendingProduct.name}`);
          }
        }
      } catch (error) {
        console.warn('[TrendTracker] Failed to fetch trending product — using legacy mode');
        trendingProduct = null;
      }
    }

    // Step 0: Resolve config — untuk custom, pakai getCustomCategoryConfig dengan nicheName.
    // Config ini diteruskan sebagai explicitConfig ke generateOutline, generateSegment, dll
    // untuk mencegah mereka memanggil getCategoryConfig('custom') yang mengembalikan placeholder.
    const config = categoryId === 'custom' && nicheName
      ? getCustomCategoryConfig(nicheName)
      : getCategoryConfig(categoryId);

    const explicitConfig: CategoryConfig | undefined = (categoryId === 'custom' && nicheName) ? config : undefined;

    // Ambil data dynamic hooks dari crawl (top performing patterns)
    const dynamicHooks = await getTopHooks(categoryId);

    // Bangun HookEntry untuk static hooks (dari file kategori)
    const staticHookEntries: HookEntry[] = (config.hookAngles ?? []).map(text => ({
      text,
      patternValue: detectHookType(text),
    }));

    // Bangun HookEntry untuk dynamic hooks
    const dynamicHookEntries: HookEntry[] = dynamicHooks.map(h => ({
      text: h.angle,
      patternValue: h.patternValue as HookPatternType,
    }));

    // Step 1: Generate outline — kirim explicitConfig untuk custom
    onProgress?.({ status: 'generating_outline', message: 'Membuat outline...' });
    const globalOutline = await generateOutline(categoryId, topic, affiliateInput, signal, explicitConfig);

    // Step 2: Generate segments
    const allScenes: Scene[] = [];

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    onProgress?.({
      status: 'generating_segments',
      currentSegment: 1,
      totalSegments,
      message: `Membuat bagian 1 dari ${totalSegments}...`,
    });

    let segment1: { scenes: Scene[]; summary: string; selectedText?: string | null; selectedPatternValue?: HookPatternType | null };
    try {
      segment1 = await generateSegment(
        categoryId, topic, duration, 0, totalSegments,
        globalOutline, '', affiliateInput, 0, signal,
        staticHookEntries, dynamicHookEntries, trendingProduct, explicitConfig
      );
      allScenes.push(...segment1.scenes);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      onProgress?.({
        status: 'error',
        message: `Gagal di bagian 1 dari ${totalSegments}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      const result = { scenes: allScenes, failedSegment: 1 };
      return result;
    }

    // Generate segments 2+ in parallel (if any)
    if (totalSegments > 1) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      onProgress?.({
        status: 'generating_segments',
        currentSegment: 2,
        totalSegments,
        message: `Membuat bagian 2-${totalSegments} secara paralel...`,
      });

      const segmentPromises: Promise<{ scenes: Scene[]; summary: string; index: number }>[] = [];
      for (let i = 1; i < totalSegments; i++) {
        segmentPromises.push(
          generateSegment(
            categoryId, topic, duration, i, totalSegments,
            globalOutline, segment1.summary, affiliateInput, 0, signal,
            staticHookEntries, dynamicHookEntries, trendingProduct, explicitConfig
          ).then(result => ({ ...result, index: i }))
        );
      }

      const results = await Promise.allSettled(segmentPromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const segIndex = i + 2;

        if (result.status === 'fulfilled') {
          allScenes.push(...result.value.scenes);
        } else {
          const error = result.reason;
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }
          onProgress?.({
            status: 'error',
            message: `Gagal di bagian ${segIndex} dari ${totalSegments}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          const failResult = { scenes: allScenes, failedSegment: segIndex };
          return failResult;
        }
      }
    }

    // Step 3: Final validation
    onProgress?.({ status: 'validating', message: 'Memvalidasi script...' });
    const validatedScenes = validateScriptScenes(allScenes, config);

    // ===== PROGRAMMATIC DISCLAIMER: Keuangan =====
    let finalScenes = validatedScenes;
    if (categoryId === 'keuangan') {
      finalScenes = [
        ...validatedScenes,
        {
          narration: 'Penting untuk diingat: konten ini hanya bersifat edukatif dan informatif, bukan merupakan saran investasi atau rekomendasi finansial. Setiap keputusan investasi memiliki risiko. Selalu lakukan riset mandiri dan konsultasikan dengan penasihat keuangan profesional sebelum mengambil keputusan investasi.',
          scene_mood: 'netral',
          image_prompt: 'Disclaimer text overlay on calm gradient background, professional and clean design, neutral colors, informative style',
          is_hook: false,
        },
      ];
    }

    // Tandai scene terakhir sebagai is_conclusion
    if (finalScenes.length > 0) {
      finalScenes[finalScenes.length - 1] = {
        ...finalScenes[finalScenes.length - 1],
        is_conclusion: true,
      };
    }

    // Validasi closing scene — log peringatan jika ada masalah, tapi tidak throw
    // agar tidak mengganggu user experience. Validasi ini bersifat safeguard,
    // bukan gatekeeper (masih ada AI prompt yang mengarahkan closing).
    const closingValidation = validateClosingScene(finalScenes);
    if (!closingValidation.valid) {
      console.warn(`[ClosingValidation] ${categoryId}: ${closingValidation.errors.join('; ')}`);
    }

    onProgress?.({ status: 'done', message: 'Script selesai dibuat!' });
    const finalResult: { scenes: Scene[]; hookPatternUsed?: string } = { scenes: finalScenes };
    if (segment1.selectedPatternValue) {
      finalResult.hookPatternUsed = segment1.selectedPatternValue;
    }
    return finalResult;
  } catch (error) {
    onProgress?.({
      status: 'error',
      message: 'Gagal generate script',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}