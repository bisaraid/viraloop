import { aiCompletion } from '@/lib/ai/completion';
import { getCategoryConfig } from '@/lib/categories';
import { getDurationConfig } from '@/lib/duration';
import { parseScriptJson, validateScriptScenes, validateContentRules, validationFailureCounters } from '@/lib/script-validator';
import { Scene, CategoryId, DurationTier, AffiliateInput, GenerateScriptProgress } from '@/lib/types';
import { getOptionalEnvVar } from '@/lib/env';

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
 * Build the system prompt for a given category
 */
function buildSystemPrompt(categoryId: CategoryId): string {
  const config = getCategoryConfig(categoryId);
  let prompt = `Kamu adalah penulis script video pendek bahasa Indonesia. 
Persona: ${config.persona}

STRUKTUR CERITA:
${config.storyStructure}

ATURAN:
${config.rules}

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
Hindari pengulangan pola pembuka yang sama setiap generate.`;

  if (config.hookAngles && config.hookAngles.length > 0) {
    const selectedAngle = config.hookAngles[Math.floor(Math.random() * config.hookAngles.length)];
    prompt += `\n\nHOOK ANGLE UNTUK GENERATE INI: ${selectedAngle}`;
  }

  return prompt;
}

/**
 * Build the user prompt for segment generation
 */
function buildSegmentPrompt(
  categoryId: CategoryId,
  topic: string,
  duration: DurationTier,
  segmentIndex: number,
  totalSegments: number,
  globalOutline: string,
  previousSummary: string,
  affiliateInput?: AffiliateInput
): string {
  const durConfig = getDurationConfig(duration);
  const scenesPerSegment = Math.ceil(durConfig.targetScenes / totalSegments);

  let prompt = '';

  if (segmentIndex === 0) {
    // First segment: generate first scenes using the global outline
    prompt = `Buat script video ${categoryId === 'affiliate' ? 'review produk' : categoryId} dengan topik: "${topic}"
    
OUTLINE GLOBAL CERITA:
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

Buat scene-scene pertama sesuai outline di atas. Scene pertama (is_hook: true) harus hook yang kuat.`;
  } else {
    // Subsequent segments: use outline + previous summary for continuity
    const startScene = segmentIndex * scenesPerSegment + 1;
    const endScene = Math.min((segmentIndex + 1) * scenesPerSegment, durConfig.targetScenes);
    prompt = `Lanjutkan script video dengan topik: "${topic}"

OUTLINE GLOBAL CERITA:
${globalOutline}

${previousSummary ? `RINGKASAN BAGIAN SEBELUMNYA (untuk referensi kontinuitas):\n${previousSummary}\n` : ''}

Target: ${scenesPerSegment} scene berikutnya (scene ${startScene} sampai ${endScene}).

Lanjutkan cerita dari outline global di atas. Pastikan:
- Karakter/tokoh KONSISTEN dengan outline
- Nama tokoh dan setting KONSISTEN
- Alur cerita nyambung logis mengikuti outline
- Mood sesuai dengan perkembangan cerita
- Jangan ulangi adegan yang sudah terjadi

PENTING: Gunakan outline global sebagai panduan utama. Ringkasan sebelumnya hanya untuk referensi kontinuitas.`;
  }

  return prompt;
}

/**
 * Generate a single segment of the script
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
  signal?: AbortSignal
): Promise<{ scenes: Scene[]; summary: string; hasValidationFlagged?: boolean }> {
  const systemPrompt = buildSystemPrompt(categoryId);
  const userPrompt = buildSegmentPrompt(
    categoryId, topic, duration, segmentIndex, totalSegments,
    globalOutline, previousSummary, affiliateInput
  );

  const config = getCategoryConfig(categoryId);
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
          globalOutline, previousSummary, affiliateInput, retryCount + 1, signal
        );
      }

      // Hard fallback: mark scenes as flagged instead of throwing
      const flaggedScenes = validatedScenes.map((scene, idx) => ({
        ...scene,
        flagged: contentValidation.flaggedSceneIndices.includes(idx),
      }));
      const summary = generateSegmentSummary(flaggedScenes, segmentIndex);
      return { scenes: flaggedScenes, summary, hasValidationFlagged: true };
    }

    // Generate summary of this segment for next segment's context
    const summary = generateSegmentSummary(validatedScenes, segmentIndex);

    return { scenes: validatedScenes, summary };
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
        globalOutline, previousSummary, affiliateInput, retryCount + 1, signal
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
 */
async function generateOutline(categoryId: CategoryId, topic: string, affiliateInput?: AffiliateInput, signal?: AbortSignal): Promise<string> {
  const config = getCategoryConfig(categoryId);

  const prompt = `Buat outline 3-5 kalimat untuk cerita ${categoryId === 'affiliate' ? 'review produk' : categoryId} dengan topik: "${topic}"

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

  const result = await aiCompletion({
    model: MODEL!,
    messages: [
      { role: 'system', content: `Kamu adalah penulis script ${config.name} Indonesia. Buat outline singkat.` },
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
  signal?: AbortSignal
): Promise<{ scenes: Scene[]; failedSegment?: number }> {
  // Cek cache — DINONAKTIFKAN untuk script generation agar setiap generate unik
  // Jika ingin re-enable, uncomment baris di bawah dan pastikan cache key
  // include randomization (hook angle / timestamp) agar user berbeda tidak dapat hasil identik.
  // const cacheKey = getCacheKey(categoryId, topic, duration, affiliateInput);
  // const cached = getFromCache(cacheKey);
  // if (cached) {
  //   return cached;
  // }

  const durConfig = getDurationConfig(duration);
  const totalSegments = durConfig.segments;
  const scenesPerSegment = Math.ceil(durConfig.targetScenes / totalSegments);

  try {
    // Step 1: Generate outline (sequential — wajib)
    onProgress?.({ status: 'generating_outline', message: 'Membuat outline cerita...' });
    const globalOutline = await generateOutline(categoryId, topic, affiliateInput, signal);

    // Step 2: Generate segments
    // Segment 1: sequential (has the hook, needs full outline context)
    // Segments 2+: parallel (each gets the full outline + segment 1 summary)
    const allScenes: Scene[] = [];

    // Cek cancel sebelum mulai
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    onProgress?.({
      status: 'generating_segments',
      currentSegment: 1,
      totalSegments,
      message: `Membuat bagian 1 dari ${totalSegments}...`,
    });

    let segment1: { scenes: Scene[]; summary: string };
    try {
      segment1 = await generateSegment(
        categoryId, topic, duration, 0, totalSegments,
        globalOutline, '', affiliateInput, 0, signal
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
      // setCache(cacheKey, result); // cache disabled
      return result;
    }

    // Generate segments 2+ in parallel (if any)
    if (totalSegments > 1) {
      // Cek cancel sebelum parallel
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
            globalOutline, segment1.summary, affiliateInput, 0, signal
          ).then(result => ({ ...result, index: i }))
        );
      }

      // Wait for all parallel segments with a timeout per segment
      const results = await Promise.allSettled(segmentPromises);

      // Process results in order
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const segIndex = i + 2; // 2-based

        if (result.status === 'fulfilled') {
          allScenes.push(...result.value.scenes);
        } else {
          const error = result.reason;
          // AbortError: propagate up
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }
          // Partial failure: return what we have
          onProgress?.({
            status: 'error',
            message: `Gagal di bagian ${segIndex} dari ${totalSegments}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          const failResult = { scenes: allScenes, failedSegment: segIndex };
          // setCache(cacheKey, failResult); // cache disabled
          return failResult;
        }
      }
    }

    // Step 3: Final validation
    onProgress?.({ status: 'validating', message: 'Memvalidasi script...' });
    const config = getCategoryConfig(categoryId);
    const validatedScenes = validateScriptScenes(allScenes, config);

    onProgress?.({ status: 'done', message: 'Script selesai dibuat!' });
    const finalResult = { scenes: validatedScenes };
    // setCache(cacheKey, finalResult); // cache disabled
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