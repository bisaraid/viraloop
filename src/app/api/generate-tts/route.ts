import { NextRequest, NextResponse } from 'next/server';
import { Scene, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings } from '@/lib/types';
import { validateApiKey } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ===== LAPISAN 1: Rate limit universal (sebelum auth) =====
  const layer1 = await checkRateLimit(`layer1:${ip}`, 10, 60_000);
  if (!layer1.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak request. Coba lagi dalam ${layer1.resetInSeconds} detik.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': layer1.resetInSeconds.toString(),
          'X-RateLimit-Remaining': layer1.remaining.toString(),
        },
      }
    );
  }

  // ===== AUTH CHECK =====
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  // ===== LAPISAN 2: Rate limit per jalur (setelah auth) =====
  const layer2Key = auth.isSameOrigin ? `layer2:${ip}:same-origin` : `layer2:${ip}:apikey`;
  const layer2Max = auth.isSameOrigin ? 3 : 10;
  const layer2 = await checkRateLimit(layer2Key, layer2Max, 60_000);
  if (!layer2.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak request. Coba lagi dalam ${layer2.resetInSeconds} detik.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': layer2.resetInSeconds.toString(),
          'X-RateLimit-Remaining': layer2.remaining.toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { scenes, provider, settings, preview } = body;

    // Validasi field wajib
    if (!scenes || !provider || !settings) {
      return NextResponse.json(
        { success: false, error: 'Field scenes, provider, dan settings wajib diisi' },
        { status: 400 }
      );
    }

    // Validasi scenes harus array tidak kosong
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Field scenes harus berupa array yang tidak kosong' },
        { status: 400 }
      );
    }

    // Validasi provider
    const validProviders: TTSProviderId[] = ['cartesia', 'elevenlabs', 'google'];
    if (!validProviders.includes(provider as TTSProviderId)) {
      return NextResponse.json(
        { success: false, error: `Provider TTS tidak valid. Pilihan: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Jika preview: true, potong narasi scene pertama ke 7 kata
    let scenesToProcess = scenes as Scene[];
    if (preview === true) {
      const originalText = scenes[0].narration;
      const truncated = originalText.split(' ').slice(0, 7).join(' ');
      scenesToProcess = [{ ...scenes[0], narration: truncated }];
      console.log(`[TTS] Preview mode: "${truncated}..."`);
    }

    // Fallback chain: coba provider yg dipilih user dulu, lalu ElevenLabs → Cartesia → Google
    const fallbackOrder: TTSProviderId[] = ['elevenlabs', 'cartesia', 'google'];
    const providersToTry = [provider as TTSProviderId, ...fallbackOrder.filter(p => p !== provider)];

    let audioBuffer: ArrayBuffer | undefined;
    let usedProvider: TTSProviderId | undefined;

    for (const prov of providersToTry) {
      try {
        switch (prov) {
          case 'elevenlabs': {
            const { generateElevenLabsSpeech } = await import('@/lib/tts/elevenlabs');
            audioBuffer = await generateElevenLabsSpeech(scenesToProcess, settings as ElevenLabsSettings);
            break;
          }
          case 'cartesia': {
            const { generateCartesiaSpeech } = await import('@/lib/tts/cartesia');
            audioBuffer = await generateCartesiaSpeech(scenesToProcess, settings as CartesiaSettings);
            break;
          }
          case 'google': {
            const { generateGoogleSpeech } = await import('@/lib/tts/google-tts');
            audioBuffer = await generateGoogleSpeech(scenesToProcess, settings as GTTSSettings);
            break;
          }
        }
        if (audioBuffer !== undefined) {
          usedProvider = prov;
          console.log(`[TTS] ✅ Provider ${prov} sukses`);
          break;
        }
      } catch (err) {
        console.warn(`[TTS] ❌ Provider ${prov} gagal, mencoba provider berikutnya...`, err);
      }
    }

    if (audioBuffer === undefined) {
      return NextResponse.json(
        { success: false, error: 'Semua provider TTS gagal. Coba lagi atau pilih provider lain.' },
        { status: 500 }
      );
    }

    // Convert ArrayBuffer to Buffer for response
    const buffer = Buffer.from(audioBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Generate TTS error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat generate audio',
      },
      { status: 500 }
    );
  }
}