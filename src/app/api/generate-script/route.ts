 import { NextRequest, NextResponse } from 'next/server';
import { generateScript } from '@/lib/script-generator';
import { CategoryId, DurationTier } from '@/lib/types';
import { validateApiKey } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service';

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
    const { category, topic, duration, affiliateInput, nicheName } = body;

    // Validate required fields
    if (!category || !topic || !duration) {
      return NextResponse.json(
        { success: false, error: 'Field category, topic, dan duration wajib diisi' },
        { status: 400 }
      );
    }

    // Validate affiliate input
    if (category === 'affiliate') {
      if (!affiliateInput || !affiliateInput.productName || !affiliateInput.productDescription) {
        return NextResponse.json(
          { success: false, error: 'Untuk kategori affiliate, field productName dan productDescription wajib diisi' },
          { status: 400 }
        );
      }
      // Untuk mode perbandingan (long), cek comparisonProducts
      if (duration === 'long' && affiliateInput.comparisonProducts && affiliateInput.comparisonProducts.length > 0) {
        if (affiliateInput.comparisonProducts.length > 3) {
          return NextResponse.json(
            { success: false, error: 'Maksimal 3 produk untuk mode perbandingan' },
            { status: 400 }
          );
        }
        for (const p of affiliateInput.comparisonProducts) {
          if (!p.productName || !p.productDescription) {
            return NextResponse.json(
              { success: false, error: 'Setiap produk perbandingan wajib memiliki productName dan productDescription' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate category
    const validCategories: CategoryId[] = ['horror', 'psikologi', 'romance', 'motivasi', 'edukasi', 'affiliate', 'misteri', 'sejarah', 'keuangan', 'custom'];
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

    // Generate identityKey placeholder (integrasi penuh dengan cookie di Task 4)
    // Saat ini: gunakan IP sebagai identity sementara
    const identityKey = `anon:${ip}`;

    // Generate script
    const result = await generateScript(
      category as CategoryId,
      topic,
      duration as DurationTier,
      affiliateInput,
      undefined,
      undefined,
      nicheName,
      identityKey
    );

    // Simpan ke script_generations (fire-and-forget — tidak blokir response)
    if (result.scenes.length > 0) {
      try {
        const supabase = createServiceRoleClient();
        // Cari category_id dari slug
        const { data: catData } = await supabase
          .from('content_categories')
          .select('id')
          .eq('slug', category)
          .single();

        if (catData) {
          await supabase.from('script_generations').insert({
            category_id: catData.id,
            user_input: topic,
            hook_pattern_used: result.hookPatternUsed ?? null,
            final_script: JSON.stringify(result.scenes),
            llm_provider: 'groq',
          });
        }
      } catch (saveError) {
        // Jangan gagalkan response jika gagal save — ini non-kritikal
        console.warn('[generate-script] Gagal menyimpan ke script_generations:', saveError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scenes: result.scenes,
        failedSegment: result.failedSegment ?? null,
        totalScenes: result.scenes.length,
        flaggedScenes: result.scenes.filter((s) => s.flagged).length,
        hookPatternUsed: result.hookPatternUsed ?? null,
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