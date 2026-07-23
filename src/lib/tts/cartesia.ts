import { Scene, CartesiaSettings } from '@/lib/types';

const CARTESIA_API_BASE = 'https://api.cartesia.ai';

export async function generateCartesiaSpeech(scenes: Scene[], settings: CartesiaSettings): Promise<ArrayBuffer> {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY tidak ditemukan di environment variables');
  }

  // Combine all narrations into one transcript
  const fullTranscript = scenes.map(s => s.narration).join(' ');

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
        id: settings.voice_id,
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
}