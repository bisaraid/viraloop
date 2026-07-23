import { NextRequest, NextResponse } from 'next/server';
import { generateScript } from '@/lib/script-generator';
import { CategoryId, DurationTier } from '@/lib/types';
import { validateApiKey } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // ===== LAPISAN 1: Rate limit universal (sebelum auth) =====
  // Mencegah brute-force/flood mentah sebelum diproses apapun
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
  // Same-origin: 3 req/menit, API key: 10 req/menit
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
    const { category, topic, duration, affiliateInput } = body;

    // Validate required fields
    if (!category || !topic || !duration) {
      return NextResponse.json(
        { success: false, error: 'Field category, topic, dan duration wajib diisi' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: CategoryId[] = ['horror', 'psychology', 'romance', 'motivation', 'education', 'affiliate'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Kategori tidak valid. Pilihan: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations: DurationTier[] = ['short', 'standard', 'long'];
    if (!validDurations.includes(duration)) {
      return NextResponse.json(
        { success: false, error: `Durasi tidak valid. Pilihan: ${validDurations.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate script
    const result = await generateScript(
      category as CategoryId,
      topic,
      duration as DurationTier,
      affiliateInput
    );

    return NextResponse.json({
      success: true,
      data: {
        scenes: result.scenes,
        failedSegment: result.failedSegment ?? null,
        totalScenes: result.scenes.length,
      },
    });
  } catch (error) {
    console.error('Generate script error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat generate script',
      },
      { status: 500 }
    );
  }
}