import { Scene, TTSProviderId, TTSSettings } from '@/lib/types';

export interface TTSProvider {
  id: TTSProviderId;
  name: string;
  generate(scenes: Scene[], settings: TTSSettings): Promise<Buffer>;
  getRequiredSettings(): string[];
}

// We'll implement each provider separately