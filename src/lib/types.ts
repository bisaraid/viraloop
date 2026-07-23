export type CategoryId = 'horror' | 'psychology' | 'romance' | 'motivation' | 'education' | 'affiliate';

export type DurationTier = 'short' | 'standard' | 'long';

export type Mood =
  | 'misterius' | 'mencekam' | 'gelap' | 'intens' | 'shock' | 'sunyi' | 'lega'
  | 'fakta' | 'terang'
  | 'hangat' | 'sedih' | 'rindu' | 'netral'
  | 'semangat' | 'reflektif';

export interface Scene {
  narration: string;
  scene_mood: string;
  image_prompt: string;
  is_hook: boolean;
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
  hasCustomInput?: boolean;
  customInputLabel?: string;
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

// Affiliate input
export interface AffiliateInput {
  productUrl?: string;
  productDescription: string;
  reviews: string[]; // minimal 1
}

// API types
export interface GenerateScriptRequest {
  category: CategoryId;
  topic: string;
  duration: DurationTier;
  affiliateInput?: AffiliateInput;
}

export interface GenerateTTSRequest {
  scenes: Scene[];
  provider: TTSProviderId;
  settings: TTSSettings;
}

export interface ScriptSegmentResult {
  scenes: Scene[];
  segmentIndex: number;
  totalSegments: number;
}

export interface GenerateScriptProgress {
  status: 'generating_outline' | 'generating_segments' | 'validating' | 'done' | 'error';
  currentSegment?: number;
  totalSegments?: number;
  message?: string;
  error?: string;
}