import { Scene, ElevenLabsSettings } from '@/lib/types';
import { loadProviderKeys, executeWithRotation } from './key-rotator';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

// Load keys saat module di-import
const elevenlabsKeys = loadProviderKeys('ELEVENLABS');

export async function generateElevenLabsSpeech(scenes: Scene[], settings: ElevenLabsSettings): Promise<ArrayBuffer> {
  if (elevenlabsKeys.length === 0) {
    throw new Error('Tidak ada ELEVENLABS_API_KEY_N di environment variables');
  }

  const fullTranscript = scenes.map(s => s.narration).join(' ');

  return executeWithRotation(elevenlabsKeys, async (apiKey, voiceId) => {
    const response = await fetch(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId || settings.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'eleven_multilingual_v2',
        text: fullTranscript,
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          use_speaker_boost: settings.use_speaker_boost,
          speed: settings.speed,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorBody}`);
    }

    return response.arrayBuffer();
  });
}