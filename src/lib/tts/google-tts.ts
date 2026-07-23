import { Scene, GTTSSettings } from '@/lib/types';

const GOOGLE_TTS_BASE = 'https://translate.google.com/translate_tts';

/**
 * Split text into chunks of maxChars length (break at sentence boundaries)
 */
function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Generate speech using Google Translate TTS endpoint (PURE JS, NO PYTHON)
 * 
 * Note: Google TTS has ~200 char limit per request, so we split long texts.
 * This endpoint is free and doesn't require an API key.
 * Quality is limited compared to Cartesia/ElevenLabs.
 */
export async function generateGoogleSpeech(scenes: Scene[], settings: GTTSSettings): Promise<ArrayBuffer> {
  const fullText = scenes.map(s => s.narration).join('. ');

  // Google TTS max ~200 chars per call, split by sentences
  const chunks = splitText(fullText, 180);

  if (chunks.length === 0) {
    throw new Error('Teks kosong untuk TTS');
  }

  // Fetch all chunks in parallel
  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        ie: 'UTF-8',
        q: chunk,
        tl: settings.lang || 'id',
        client: 'tw-ob',
      });
      const url = `${GOOGLE_TTS_BASE}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google TTS error (${response.status}): ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
  );

  // If only one chunk, return directly
  if (responses.length === 1) {
    return responses[0];
  }

  // Merge multiple MP3 chunks into one
  return mergeAudioBuffers(responses);
}

/**
 * Simple MP3 concatenation - joins multiple MP3 buffers sequentially.
 * This works because MP3 files can be concatenated byte-by-byte.
 */
function mergeAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return merged.buffer;
}