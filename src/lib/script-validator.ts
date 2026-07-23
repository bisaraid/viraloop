import { Scene, CategoryConfig } from '@/lib/types';

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