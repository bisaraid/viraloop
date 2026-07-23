import { NextRequest, NextResponse } from 'next/server';
import { Scene, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenes, provider, settings } = body;

    if (!scenes || !provider || !settings) {
      return NextResponse.json(
        { error: 'Field scenes, provider, dan settings wajib diisi' },
        { status: 400 }
      );
    }

    let audioBuffer: ArrayBuffer;

    switch (provider as TTSProviderId) {
      case 'cartesia': {
        const { generateCartesiaSpeech } = await import('@/lib/tts/cartesia');
        audioBuffer = await generateCartesiaSpeech(scenes as Scene[], settings as CartesiaSettings);
        break;
      }
      case 'elevenlabs': {
        const { generateElevenLabsSpeech } = await import('@/lib/tts/elevenlabs');
        audioBuffer = await generateElevenLabsSpeech(scenes as Scene[], settings as ElevenLabsSettings);
        break;
      }
      case 'google': {
        const { generateGoogleSpeech } = await import('@/lib/tts/google-tts');
        audioBuffer = await generateGoogleSpeech(scenes as Scene[], settings as GTTSSettings);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Provider TTS tidak valid: ${provider}` },
          { status: 400 }
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
