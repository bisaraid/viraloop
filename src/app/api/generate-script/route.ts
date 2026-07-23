import { NextRequest, NextResponse } from 'next/server';
import { generateScript } from '@/lib/script-generator';
import { CategoryId, DurationTier } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, topic, duration, affiliateInput } = body;

    // Validate required fields
    if (!category || !topic || !duration) {
      return NextResponse.json(
        { error: 'Field category, topic, dan duration wajib diisi' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: CategoryId[] = ['horror', 'psychology', 'romance', 'motivation', 'education', 'affiliate'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Kategori tidak valid. Pilihan: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations: DurationTier[] = ['short', 'standard', 'long'];
    if (!validDurations.includes(duration)) {
      return NextResponse.json(
        { error: `Durasi tidak valid. Pilihan: ${validDurations.join(', ')}` },
        { status: 400 }
      );
    }

    // For affiliate category, validate affiliate input
    if (category === 'affiliate') {
      if (!affiliateInput || !affiliateInput.productDescription) {
        return NextResponse.json(
          { error: 'Untuk kategori affiliate, deskripsi produk wajib diisi' },
          { status: 400 }
        );
      }
      if (!affiliateInput.reviews || affiliateInput.reviews.length < 1) {
        return NextResponse.json(
          { error: 'Minimal 1 ulasan produk wajib diisi untuk kategori affiliate' },
          { status: 400 }
        );
      }
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
      scenes: result.scenes,
      failedSegment: result.failedSegment ?? null,
      totalScenes: result.scenes.length,
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