/**
 * insight-narrative.ts — Rule-based narrative generator for pattern insights.
 *
 * MURNI template/rule-based, TIDAK memanggil LLM apapun.
 * Mengubah angka mentah pattern_insights menjadi paragraf narasi
 * yang menjelaskan KENAPA suatu pattern performa tinggi/rendah.
 */

export interface NarrativeInput {
  categoryName: string;
  baseline: number;
  patterns: Array<{
    pattern_key: string;
    pattern_value: string;
    avg_view_count: number | null;
    sample_count: number | null;
    low_confidence: boolean;
  }>;
}

export interface NarrativeOutput {
  /** One combined narrative paragraph per category */
  narrative: string;
}

// ===== Helpers =====

const patternKeyReadable: Record<string, string> = {
  hook_type: 'hook',
  duration_bucket: 'durasi',
  title_length_bucket: 'panjang judul',
};

function getPerformanceLabel(ratio: number): { label: string; adverb: string } {
  if (ratio >= 2.0) {
    return { label: 'SANGAT KUAT', adverb: 'sangat kuat' };
  }
  if (ratio >= 1.2) {
    return { label: 'DI ATAS rata-rata', adverb: 'di atas rata-rata' };
  }
  if (ratio >= 0.8) {
    return { label: 'SETARA rata-rata', adverb: 'setara rata-rata, bukan pembeda kuat' };
  }
  return { label: 'DI BAWAH rata-rata', adverb: 'di bawah rata-rata, sebaiknya dihindari' };
}

function generateSinglePatternSentence(
  p: NarrativeInput['patterns'][0],
  baseline: number,
): string {
  const avg = p.avg_view_count ?? 0;
  const ratio = baseline > 0 ? avg / baseline : 0;
  const { adverb } = getPerformanceLabel(ratio);
  const keyLabel = patternKeyReadable[p.pattern_key] || p.pattern_key;
  const ratioFormatted = ratio.toFixed(2);

  let sentence = `Pattern ${keyLabel} berupa "${p.pattern_value}" memiliki performa ${adverb}`;
  sentence += ` — rata-rata ${avg.toLocaleString('id-ID')} views (${ratioFormatted}x lipat dari baseline`;
  if (p.sample_count != null) {
    sentence += `, dari ${p.sample_count} sampel`;
  }
  sentence += ')';

  if (p.low_confidence) {
    sentence += `. Data masih terbatas (baru ${p.sample_count ?? '?'} sampel) — insight ini butuh lebih banyak data sebelum bisa diandalkan penuh`;
  }

  sentence += '.';
  return sentence;
}

/**
 * Classify a single pattern into a performance tier string.
 */
function classifyPattern(p: NarrativeInput['patterns'][0], baseline: number): string {
  const avg = p.avg_view_count ?? 0;
  const ratio = baseline > 0 ? avg / baseline : 0;
  if (ratio >= 2.0) return 'sangat_kuat';
  if (ratio >= 1.2) return 'di_atas';
  if (ratio >= 0.8) return 'setara';
  return 'di_bawah';
}

/**
 * Generate a combined flowing narrative paragraph for one category.
 *
 * Merges insights from hook_type, duration_bucket, and title_length_bucket
 * into a single cohesive paragraph rather than 3 separate rigid sentences.
 */
export function generateInsightNarrative(input: NarrativeInput): string {
  const { categoryName, baseline, patterns } = input;

  if (!patterns || patterns.length === 0) {
    return `Untuk kategori ${categoryName}, belum tersedia cukup data pattern untuk menghasilkan insight yang bermakna.`;
  }

  // Group by pattern_key
  const grouped: Record<string, NarrativeInput['patterns']> = {};
  for (const p of patterns) {
    if (!grouped[p.pattern_key]) grouped[p.pattern_key] = [];
    grouped[p.pattern_key].push(p);
  }

  const hookPatterns = grouped['hook_type'] || [];
  const durationPatterns = grouped['duration_bucket'] || [];
  const titlePatterns = grouped['title_length_bucket'] || [];

  // Find best (highest ratio) pattern per key
  const bestHook = hookPatterns.reduce((best, p) => {
    const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
    const bestRatio = baseline > 0 ? (best.avg_view_count ?? 0) / baseline : 0;
    return ratio > bestRatio ? p : best;
  }, hookPatterns[0]);

  const bestDuration = durationPatterns.reduce((best, p) => {
    const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
    const bestRatio = baseline > 0 ? (best.avg_view_count ?? 0) / baseline : 0;
    return ratio > bestRatio ? p : best;
  }, durationPatterns[0]);

  const bestTitle = titlePatterns.reduce((best, p) => {
    const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
    const bestRatio = baseline > 0 ? (best.avg_view_count ?? 0) / baseline : 0;
    return ratio > bestRatio ? p : best;
  }, titlePatterns[0]);

  // Find worst (lowest ratio) patterns for warnings
  const worstDuration = durationPatterns.reduce((worst, p) => {
    const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
    const worstRatio = baseline > 0 ? (worst.avg_view_count ?? 0) / baseline : 0;
    return ratio < worstRatio ? p : worst;
  }, durationPatterns[0]);

  // Determine if we can form a "combination" sentence (when multiple keys have strong patterns)
  const hookTier = bestHook ? classifyPattern(bestHook, baseline) : null;
  const durationTier = bestDuration ? classifyPattern(bestDuration, baseline) : null;
  const titleTier = bestTitle ? classifyPattern(bestTitle, baseline) : null;

  const strongKeys: string[] = [];
  if (hookTier === 'sangat_kuat' || hookTier === 'di_atas') strongKeys.push('hook');
  if (durationTier === 'sangat_kuat' || durationTier === 'di_atas') strongKeys.push('durasi');
  if (titleTier === 'sangat_kuat' || titleTier === 'di_atas') strongKeys.push('panjang judul');

  const weakKeys: string[] = [];
  if (durationTier === 'di_bawah') weakKeys.push('durasi');
  if (titleTier === 'di_bawah') weakKeys.push('panjang judul');
  if (hookTier === 'di_bawah') weakKeys.push('hook');

  const parts: string[] = [];
  parts.push(`Untuk kategori ${categoryName},`);

  // === Combination sentence (best performing patterns) ===
  if (strongKeys.length >= 2 && bestHook && bestDuration) {
    // Build a combined sentence
    const bestHookLabel = bestHook.pattern_value;
    const bestDurationLabel = bestDuration.pattern_value;
    const bestHookRatio = baseline > 0 ? ((bestHook.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
    const bestDurationRatio = baseline > 0 ? ((bestDuration.avg_view_count ?? 0) / baseline).toFixed(2) : '?';

    let comboSentence = `kombinasi paling efektif adalah hook berupa "${bestHookLabel}" dengan durasi "${bestDurationLabel}"`;
    comboSentence += ` — kedua pattern ini sama-sama terbukti ${strongKeys.length === 2 ? 'di atas rata-rata' : 'sangat kuat'}`;
    comboSentence += ` (hook: ${bestHookRatio}x, durasi: ${bestDurationRatio}x lipat dari rata-rata)`;

    if (bestTitle && (titleTier === 'sangat_kuat' || titleTier === 'di_atas')) {
      comboSentence += `. Panjang judul "${bestTitle.pattern_value}" juga mendukung dengan performa di atas rata-rata`;
    }

    parts.push(comboSentence);
  } else if (strongKeys.length >= 1 && bestHook) {
    // Single strong key: just mention the best pattern
    const best = strongKeys.includes('hook') ? bestHook
      : strongKeys.includes('durasi') ? bestDuration
      : bestTitle;

    const keyLabel = patternKeyReadable[best.pattern_key] || best.pattern_key;
    const ratio = baseline > 0 ? ((best.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
    const tierLabel = classifyPattern(best, baseline) === 'sangat_kuat' ? 'SANGAT KUAT' : 'DI ATAS rata-rata';

    parts.push(
      `pattern ${keyLabel} berupa "${best.pattern_value}" terbukti ${tierLabel} — ` +
      `rata-rata ${(best.avg_view_count ?? 0).toLocaleString('id-ID')} views (${ratio}x lipat dari baseline` +
      (best.sample_count != null ? `, dari ${best.sample_count} sampel` : '') + ')'
    );

    // If another key is also strong-ish, mention it briefly
    if (bestDuration && bestDuration !== best && durationTier === 'di_atas') {
      const dRatio = baseline > 0 ? ((bestDuration.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
      parts.push(`durasi "${bestDuration.pattern_value}" juga menunjukkan performa positif (${dRatio}x)`);
    }
  } else {
    // Nothing is strongly above average
    const bestOverall = [bestHook, bestDuration, bestTitle]
      .filter(Boolean)
      .sort((a, b) => {
        const rA = baseline > 0 ? ((a?.avg_view_count ?? 0) / baseline) : 0;
        const rB = baseline > 0 ? ((b?.avg_view_count ?? 0) / baseline) : 0;
        return rB - rA;
      })[0];

    if (bestOverall) {
      const keyLabel = patternKeyReadable[bestOverall.pattern_key] || bestOverall.pattern_key;
      const ratio = baseline > 0 ? ((bestOverall.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
      parts.push(
        `tidak ada pattern yang menonjol secara signifikan — pattern ${keyLabel} "${bestOverall.pattern_value}" ` +
        `paling mendekati rata-rata dengan rasio ${ratio}x`
      );
    } else {
      parts.push('belum tersedia cukup data pattern untuk memberikan rekomendasi yang berarti');
    }
  }

  // === Warning for weak patterns ===
  if (weakKeys.length >= 1) {
    const weakParts: string[] = [];
    if (weakKeys.includes('durasi') && worstDuration) {
      const wRatio = baseline > 0 ? ((worstDuration.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
      weakParts.push(`durasi "${worstDuration.pattern_value}" yang performanya hanya ${wRatio}x dari rata-rata`);
    }
    if (weakKeys.includes('hook')) {
      const worstHook = hookPatterns.reduce((worst, p) => {
        const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
        const worstRatio = baseline > 0 ? (worst.avg_view_count ?? 0) / baseline : 0;
        return ratio < worstRatio ? p : worst;
      }, hookPatterns[0]);
      if (worstHook) {
        const wRatio = baseline > 0 ? ((worstHook.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
        weakParts.push(`hook "${worstHook.pattern_value}" yang hanya ${wRatio}x dari rata-rata`);
      }
    }
    if (weakKeys.includes('panjang judul') && bestTitle) {
      // check if title has a below-average variant
      const worstTitle = titlePatterns.reduce((worst, p) => {
        const ratio = baseline > 0 ? (p.avg_view_count ?? 0) / baseline : 0;
        const worstRatio = baseline > 0 ? (worst.avg_view_count ?? 0) / baseline : 0;
        return ratio < worstRatio ? p : worst;
      }, titlePatterns[0]);
      if (worstTitle && classifyPattern(worstTitle, baseline) === 'di_bawah') {
        const wRatio = baseline > 0 ? ((worstTitle.avg_view_count ?? 0) / baseline).toFixed(2) : '?';
        weakParts.push(`panjang judul "${worstTitle.pattern_value}" yang hanya ${wRatio}x dari rata-rata`);
      }
    }

    if (weakParts.length > 0) {
      parts.push(`Sebaliknya, hindari ${weakParts.join(', ')} — pattern ini terbukti kurang efektif untuk kategori ${categoryName}`);
    }
  }

  // === Low confidence notices for any pattern ===
  const lowConfPatterns = patterns.filter(p => p.low_confidence);
  if (lowConfPatterns.length >= 2) {
    parts.push(
      `Catatan: banyak pattern di atas masih bertumpu pada data terbatas ` +
      `(${lowConfPatterns.length} dari ${patterns.length} pattern memiliki sampel minim) — ` +
      `interpretasi ini perlu divalidasi ulang seiring bertambahnya data`
    );
  } else if (lowConfPatterns.length === 1) {
    const lcp = lowConfPatterns[0];
    parts.push(
      `Catatan: pattern ${patternKeyReadable[lcp.pattern_key] || lcp.pattern_key} ` +
      `"${lcp.pattern_value}" masih berdasarkan data terbatas (${lcp.sample_count ?? '?'} sampel) — ` +
      `perlu lebih banyak data sebelum bisa diandalkan penuh`
    );
  }

  return parts.join(' ') + '.';
}

/**
 * Generate narratives for multiple categories from API data.
 *
 * @param patternInsights - flat array of pattern_insights rows from DB
 * @param baselines - Record<category_id, baseline avg view count>
 * @param categories - array of { id, name }
 * @returns Record<category_id, narrative string>
 */
export function generateAllNarratives(
  patternInsights: Array<{
    category_id: string;
    pattern_key: string;
    pattern_value: string;
    avg_view_count: number | null;
    sample_count: number | null;
    low_confidence: boolean;
  }>,
  baselines: Record<string, number>,
  categories: Array<{ id: string; name: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const cat of categories) {
    const catPatterns = patternInsights.filter(p => p.category_id === cat.id);
    const baseline = baselines[cat.id] || 0;

    result[cat.id] = generateInsightNarrative({
      categoryName: cat.name,
      baseline,
      patterns: catPatterns,
    });
  }

  return result;
}