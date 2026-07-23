import { Scene, GTTSSettings } from '@/lib/types';

/**
 * Google Cloud Text-to-Speech API implementation
 * 
 * Menggunakan Google Cloud TTS API resmi via REST endpoint.
 * Memerlukan GOOGLE_TTS_API_KEY di environment variables.
 * 
 * Jika GOOGLE_TTS_API_KEY tidak tersedia, akan menggunakan node-gtts
 * sebagai fallback (endpoint translate.google.com tidak resmi).
 * 
 * TODO: Hapus fallback node-gtts jika sudah migrasi penuh ke Google Cloud TTS.
 */

const GOOGLE_TTS_API_BASE = 'https://texttospeech.googleapis.com/v1';

/**
 * Generate speech using Google Cloud TTS API (resmi)
 */
async function generateGoogleCloudTTS(text: string, lang: string, slow: boolean): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_TTS_API_KEY tidak ditemukan di environment variables');
  }

  const response = await fetch(
    `${GOOGLE_TTS_API_BASE}/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: lang === 'id' ? 'id-ID' : lang,
          name: getGoogleVoiceName(lang),
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: slow ? 0.8 : 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Google Cloud TTS] Error ${response.status}:`, errorBody);
    throw new Error(`Google Cloud TTS gagal (${response.status}). Coba gunakan provider lain.`);
  }

  const data = await response.json();
  const audioContent = data.audioContent as string;
  return Buffer.from(audioContent, 'base64');
}

/**
 * Dapatkan voice name yang sesuai berdasarkan kode bahasa
 */
function getGoogleVoiceName(lang: string): string {
  const voiceMap: Record<string, string> = {
    'id': 'id-ID-Standard-A',
    'en': 'en-US-Standard-J',
    'ja': 'ja-JP-Standard-A',
  };
  return voiceMap[lang] || 'id-ID-Standard-A';
}

/**
 * Fallback menggunakan node-gtts (endpoint tidak resmi)
 * Hanya digunakan jika GOOGLE_TTS_API_KEY tidak tersedia
 *
 * node-gtts.stream() mengembalikan Node.js Readable stream,
 * bukan Buffer. Kita collect chunks jadi Buffer di sini.
 */
async function generateGtts(text: string, lang: string = 'id'): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gtts = require('node-gtts')(lang);
  const stream = gtts.stream(text);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Split text into chunks with hard limit
 * Memecah teks per kalimat, maksimal maxChars per chunk.
 * Jika ada kalimat > maxChars tanpa tanda baca, force split.
 */
function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  for (const sentence of sentences) {
    // Force split jika kalimat tunggal melebihi maxChars
    if (sentence.trim().length > maxChars) {
      // Jika currentChunk tidak kosong, push dulu
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Force split kalimat panjang per maxChars karakter
      let remaining = sentence;
      while (remaining.length > 0) {
        chunks.push(remaining.slice(0, maxChars).trim());
        remaining = remaining.slice(maxChars);
      }
      continue;
    }

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
 * Generate speech using Google Cloud TTS (resmi) jika API key tersedia,
 * fallback ke node-gtts jika tidak.
 *
 * Text panjang di-split per chunk, lalu audio digabungkan menjadi satu file MP3.
 */
export async function generateGoogleSpeech(scenes: Scene[], settings: GTTSSettings): Promise<ArrayBuffer> {
  const fullText = scenes.map(s => s.narration).join('. ');

  // Google Cloud TTS: 5000 karakter limit per request, node-gtts ~100
  // Pilih limit yang sesuai
  const hasApiKey = !!process.env.GOOGLE_TTS_API_KEY;
  const maxChars = hasApiKey ? 2000 : 100;
  const chunks = splitText(fullText, maxChars);

  if (chunks.length === 0) {
    throw new Error('Teks kosong untuk TTS');
  }

  // Generate audio untuk setiap chunk
  let buffers: Buffer[];
  if (hasApiKey) {
    // Gunakan Google Cloud TTS API resmi
    buffers = await Promise.all(
      chunks.map(chunk => generateGoogleCloudTTS(chunk, settings.lang || 'id', settings.slow))
    );
  } else {
    // Fallback ke node-gtts (endpoint tidak resmi)
    console.warn('⚠️ GOOGLE_TTS_API_KEY tidak diset — menggunakan node-gtts fallback (endpoint tidak resmi)');
    buffers = await Promise.all(
      chunks.map(chunk => generateGtts(chunk, settings.lang || 'id'))
    );
  }

  // Jika hanya satu chunk, return langsung
  if (buffers.length === 1) {
    return (buffers[0].buffer as ArrayBuffer).slice(buffers[0].byteOffset, buffers[0].byteOffset + buffers[0].byteLength);
  }

  // Merge multiple MP3 chunks into one
  return mergeAudioBuffers(buffers.map(b => (b.buffer as ArrayBuffer).slice(b.byteOffset, b.byteOffset + b.byteLength)));
}

/**
 * Simple MP3 concatenation - joins multiple MP3 buffers sequentially.
 * This works because MP3 files can be concatenated byte-by-byte.
 */
function mergeAudioBuffers(buffers: ArrayBufferLike[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return merged.buffer;
}