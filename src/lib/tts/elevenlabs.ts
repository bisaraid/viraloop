import { Scene, ElevenLabsSettings } from '@/lib/types';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

export async function generateElevenLabsSpeech(scenes: Scene[], settings: ElevenLabsSettings): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY tidak ditemukan di environment variables');
  }

  // Combine all narrations
  const fullTranscript = scenes.map(s => s.narration).join(' ');

  const response = await fetch(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${settings.voice_id}`, {
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
}