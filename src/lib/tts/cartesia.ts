import { Scene, CartesiaSettings } from '@/lib/types';
import { loadProviderKeys, executeWithRotation } from './key-rotator';

const CARTESIA_API_BASE = 'https://api.cartesia.ai';

// Named voices yang bisa dipilih di UI — berlaku untuk semua API key
const CARTESIA_NAMED_VOICES: Record<string, string> = {
  andi: 'a053f6bc-7df4-40de-96d4-de026bc47ce8',
  siti: 'b441c4fd-4910-4c55-ae56-f0291057e2cc',
};

// Load keys saat module di-import
const cartesiaKeys = loadProviderKeys('CARTESIA');

/**
 * Resolve voice ID:
 * - Jika settings.voice_id adalah "andi" atau "siti" → map ke ID
 * - Jika tidak, gunakan voice_id dari env var (CARTESIA_VOICE_ID_N) sebagai default
 * - Jika tidak ada, fallback ke settings.voice_id
 */
function resolveVoiceId(settingsVoiceId: string, envVoiceId?: string): string {
  const lower = settingsVoiceId?.toLowerCase().trim();
  if (lower && CARTESIA_NAMED_VOICES[lower]) {
    return CARTESIA_NAMED_VOICES[lower];
  }
  return envVoiceId || settingsVoiceId;
}

export async function generateCartesiaSpeech(scenes: Scene[], settings: CartesiaSettings): Promise<ArrayBuffer> {
  if (cartesiaKeys.length === 0) {
    throw new Error('Tidak ada CARTESIA_API_KEY_N di environment variables');
  }

  const fullTranscript = scenes.map(s => s.narration).join(' ');

  return executeWithRotation(cartesiaKeys, async (apiKey, envVoiceId) => {
    const voiceId = resolveVoiceId(settings.voice_id, envVoiceId);

    const response = await fetch(`${CARTESIA_API_BASE}/tts/bytes`, {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2026-03-01',
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: fullTranscript,
        voice: {
          mode: 'id',
          id: voiceId,
        },
        language: 'id',
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000,
        },
        generation_config: {
          speed: settings.speed,
          ...(settings.emotion ? { emotion: settings.emotion } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Cartesia API error (${response.status}): ${errorBody}`);
    }

    return response.arrayBuffer();
  });
}