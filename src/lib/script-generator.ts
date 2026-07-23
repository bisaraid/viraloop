import { groqCompletion } from '@/lib/ai/groq';
import { getCategoryConfig } from '@/lib/categories';
import { getDurationConfig } from '@/lib/duration';
import { parseScriptJson, validateScriptScenes } from '@/lib/script-validator';
import { Scene, CategoryId, DurationTier, AffiliateInput, GenerateScriptProgress } from '@/lib/types';

const MODEL = 'llama-3.3-70b-versatile';

/**
 * Build the system prompt for a given category
 */
function buildSystemPrompt(categoryId: CategoryId): string {
  const config = getCategoryConfig(categoryId);
  return `Kamu adalah penulis script video pendek bahasa Indonesia. 
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
URL: ${affiliateInput.productUrl || 'Tidak ada'}
Deskripsi: ${affiliateInput.productDescription}
Ulasan: ${affiliateInput.reviews.join('\n')}

INGAT: Hanya gunakan informasi yang ada di data di atas. Jangan tambahkan klaim atau spesifikasi yang tidak disebutkan user.` : ''}

Buat scene-scene pertama sesuai outline di atas. Scene pertama (is_hook: true) harus hook yang kuat.`;
  } else {
    // Subsequent segments: use outline + previous summary
    prompt = `Lanjutkan script video dengan topik: "${topic}"

OUTLINE GLOBAL CERITA:
${globalOutline}

RINGKASAN BAGIAN SEBELUMNYA:
${previousSummary}

Target: ${scenesPerSegment} scene berikutnya (scene ${segmentIndex * scenesPerSegment + 1} sampai ${Math.min((segmentIndex + 1) * scenesPerSegment, durConfig.targetScenes)}).

Lanjutkan cerita dari bagian sebelumnya. Pastikan:
- Nama tokoh dan setting KONSISTEN dengan bagian sebelumnya
- Alur cerita nyambung logis
- Mood sesuai dengan perkembangan cerita
- Jangan ulangi adegan yang sudah terjadi`;
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
  retryCount: number = 0
): Promise<{ scenes: Scene[]; summary: string }> {
  const systemPrompt = buildSystemPrompt(categoryId);
  const userPrompt = buildSegmentPrompt(
    categoryId, topic, duration, segmentIndex, totalSegments,
    globalOutline, previousSummary, affiliateInput
  );

  try {
    const result = await groqCompletion({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const parsed = parseScriptJson(result.content);
    if (!parsed || !parsed.scenes || parsed.scenes.length === 0) {
      throw new Error('Gagal parse JSON dari response AI');
    }

    // Validate moods
    const config = getCategoryConfig(categoryId);
    const validatedScenes = validateScriptScenes(parsed.scenes, config);

    // Generate summary of this segment for next segment's context
    const summary = generateSegmentSummary(validatedScenes, segmentIndex);

    return { scenes: validatedScenes, summary };
  } catch (error) {
    if (retryCount < 2) {
      console.warn(`Segment ${segmentIndex + 1} gagal, retry ${retryCount + 1}/2:`, error);
      return generateSegment(
        categoryId, topic, duration, segmentIndex, totalSegments,
        globalOutline, previousSummary, affiliateInput, retryCount + 1
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
async function generateOutline(categoryId: CategoryId, topic: string, affiliateInput?: AffiliateInput): Promise<string> {
  const config = getCategoryConfig(categoryId);

  const prompt = `Buat outline 3-5 kalimat untuk cerita ${categoryId === 'affiliate' ? 'review produk' : categoryId} dengan topik: "${topic}"

${categoryId === 'affiliate' && affiliateInput ? `
DATA PRODUK:
Deskripsi: ${affiliateInput.productDescription}
Ulasan: ${affiliateInput.reviews.join('\n')}
` : ''}

Outline harus mencakup:
- Tokoh utama (jika ada)
- Setting/latar
- Alur dari awal sampai akhir (termasuk twist jika ada)
- Mood dominan

Format: teks biasa, 3-5 kalimat saja.`;

  const result = await groqCompletion({
    model: MODEL,
    messages: [
      { role: 'system', content: `Kamu adalah penulis script ${config.name} Indonesia. Buat outline singkat.` },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'text' },
    temperature: 0.7,
  });

  return result.content.trim();
}

/**
 * Main function: Generate full script with multi-segment support
 * Returns scenes and progress updates via callback
 */
export async function generateScript(
  categoryId: CategoryId,
  topic: string,
  duration: DurationTier,
  affiliateInput?: AffiliateInput,
  onProgress?: (progress: GenerateScriptProgress) => void
): Promise<{ scenes: Scene[]; failedSegment?: number }> {
  const durConfig = getDurationConfig(duration);
  const totalSegments = durConfig.segments;

  try {
    // Step 1: Generate outline
    onProgress?.({ status: 'generating_outline', message: 'Membuat outline cerita...' });
    const globalOutline = await generateOutline(categoryId, topic, affiliateInput);

    // Step 2: Generate segments sequentially
    const allScenes: Scene[] = [];
    let previousSummary = '';

    for (let i = 0; i < totalSegments; i++) {
      onProgress?.({
        status: 'generating_segments',
        currentSegment: i + 1,
        totalSegments,
        message: `Membuat bagian ${i + 1} dari ${totalSegments}...`,
      });

      try {
        const segment = await generateSegment(
          categoryId, topic, duration, i, totalSegments,
          globalOutline, previousSummary, affiliateInput
        );
        allScenes.push(...segment.scenes);
        previousSummary = segment.summary;
      } catch (error) {
        // Partial failure: return what we have so far
        onProgress?.({
          status: 'error',
          message: `Gagal di bagian ${i + 1} dari ${totalSegments}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
          scenes: allScenes,
          failedSegment: i + 1,
        };
      }
    }

    // Step 3: Final validation
    onProgress?.({ status: 'validating', message: 'Memvalidasi script...' });
    const config = getCategoryConfig(categoryId);
    const validatedScenes = validateScriptScenes(allScenes, config);

    onProgress?.({ status: 'done', message: 'Script selesai dibuat!' });
    return { scenes: validatedScenes };
  } catch (error) {
    onProgress?.({
      status: 'error',
      message: 'Gagal generate script',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}