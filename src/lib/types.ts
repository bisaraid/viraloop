export type CategoryId = 'horror' | 'psikologi' | 'romance' | 'motivasi' | 'edukasi' | 'affiliate' | 'misteri' | 'sejarah' | 'keuangan' | 'custom';

export type DurationTier = 'short' | 'standard' | 'long';

export type Mood =
  | 'misterius' | 'mencekam' | 'gelap' | 'intens' | 'shock' | 'sunyi' | 'lega'
  | 'fakta' | 'terang'
  | 'hangat' | 'sedih' | 'rindu' | 'netral'
  | 'semangat' | 'reflektif';

/** Hook pattern type — cocok dengan pattern_insights.pattern_value untuk hook_type */
export type HookPatternType = 'pertanyaan' | 'angka' | 'clickbait_kata' | 'netral';

/**
 * Tipe skeleton alur konten:
 * - narrative_arc: alur cerita fiksi dengan tokoh, konflik, twist (horror)
 * - factual_narrative: kronologi kejadian nyata tanpa tokoh fiksi (sejarah, misteri)
 * - informational_arc: poin-poin informatif yang berdiri sendiri, bukan kelanjutan dramatis (psikologi, motivasi, edukasi, keuangan, affiliate)
 */
export type ScriptSkeleton = 'narrative_arc' | 'factual_narrative' | 'informational_arc';

/**
 * Mode penutup naskah:
 * - actionable_takeaway: scene terakhir berisi satu poin kesimpulan konkret yang bisa langsung dipraktikkan
 * - cliffhanger_follow: scene terakhir berisi elemen emosional belum terselesaikan + ajakan implisit follow
 * - open_case_factual: scene terakhir mengundang engagement strategis untuk kasus/fenomena nyata yang belum terpecahkan
 */
export type ClosingMode = 'actionable_takeaway' | 'cliffhanger_follow' | 'open_case_factual';

export interface NarratorPersona {
  name: string;
  tone: string;
  sentenceRhythm: string;
  signaturePhrases: string[];
  avoidWords: string[];
}

export interface Scene {
  narration: string;
  scene_mood: string;
  image_prompt: string;
  is_hook: boolean;
  flagged?: boolean;
  /** true jika ini scene penutup (terakhir) dari naskah */
  is_conclusion?: boolean;
}

export interface ScriptOutput {
  scenes: Scene[];
}

export interface CategoryConfig {
  id: CategoryId;
  name: string;
  persona: string;
  storyStructure: string;
  rules: string;
  validMoods: Mood[];
  styleSuffix: string;
  temperature?: number;
  exampleScenes?: Array<{
    narration: string;
    scene_mood: string;
    image_prompt?: string;
  }>;
  hookAngles?: string[];
  /** Apakah kategori ini menggunakan karakter/tokoh fiksi dalam kontennya?
   *  false = konten informatif langsung (keuangan, edukasi, misteri) — LLM dilarang membuat nama karakter
   *  true = konten berbasis cerita/karakter (horror, romance) — LLM boleh membuat karakter */
  usesFictionalCharacter?: boolean;
  /** Bentuk alur konten — membedakan cara AI menyusun outline dan segmen */
  scriptSkeleton: ScriptSkeleton;
  /** Persona narator — gaya bicara khas per kategori */
  narratorPersona: NarratorPersona;
  /** Mode penutup naskah — menentukan instruksi closing ke AI */
  closingMode: ClosingMode;
}

export interface DurationConfig {
  id: DurationTier;
  label: string;
  description: string;
  targetWords: number;
  targetScenes: number;
  segments: number;
}

// TTS Types
export type TTSProviderId = 'cartesia' | 'elevenlabs' | 'google';

export interface CartesiaSettings {
  voice_id: string;
  speed: number; // 0.6 - 1.5
  emotion?: string;
}

export interface ElevenLabsSettings {
  voice_id: string;
  stability: number; // 0.0 - 1.0
  similarity_boost: number; // 0.0 - 1.0
  style: number; // 0.0 - 1.0
  use_speaker_boost: boolean;
  speed: number; // default 1.0
}

export interface GTTSSettings {
  lang: string;
  tld: string;
  slow: boolean;
}

export type TTSSettings = CartesiaSettings | ElevenLabsSettings | GTTSSettings;

// Affiliate input — simplified, no URL crawl, no reviews
export interface AffiliateProductBasic {
  productName: string;        // wajib
  productDescription: string; // wajib — free text, fitur/deskripsi utama
  productPrice?: string;      // opsional
  productRating?: number;     // opsional
}

export interface AffiliateInput {
  productName: string;        // wajib (single product mode)
  productDescription: string; // wajib — free text, fitur/deskripsi utama
  productPrice?: string;      // opsional
  productRating?: number;     // opsional
  /** Untuk mode perbandingan (tier long/3 menit) — maksimal 3 produk */
  comparisonProducts?: AffiliateProductBasic[];
}

// API types
export interface GenerateScriptRequest {
  category: CategoryId;
  topic: string;
  duration: DurationTier;
  affiliateInput?: AffiliateInput;
  nicheName?: string; // Untuk kategori custom
}

export interface GenerateTTSRequest {
  scenes: Scene[];
  provider: TTSProviderId;
  settings: TTSSettings;
}

export interface GenerateScriptProgress {
  status: 'generating_outline' | 'generating_segments' | 'validating' | 'done' | 'error';
  currentSegment?: number;
  totalSegments?: number;
  message?: string;
  error?: string;
}