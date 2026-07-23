import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/suggest-ideas?category=horror
 *
 * Generate 5 ide konten via AI (Groq → OpenRouter fallback)
 */

const CATEGORY_NAMES: Record<string, string> = {
  horror: 'Horror',
  psychology: 'Psychology',
  romance: 'Romance',
  motivation: 'Motivation',
  education: 'Education',
  affiliate: '',
};

const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_FALLBACK_MODEL = 'openrouter/auto';

const PROMPT = (category: string) => `Berikan 5 ide konten video pendek untuk kategori ${category} yang relevan untuk audiens Indonesia. Ide harus kreatif, spesifik, dan belum terlalu umum.

Aturan:
- Bahasa Indonesia
- Masing-masing ide 3-8 kata
- Fokus pada konten yang relate dengan kehidupan sehari-hari orang Indonesia
- Kreatif dan tidak klise

Respond ONLY with a valid JSON object containing an "ideas" key with an array of strings. No explanation, no markdown, no backticks.
Example: {"ideas": ["ide 1", "ide 2", "ide 3", "ide 4", "ide 5"]}`;

const SYSTEM_MSG = 'Kamu adalah kreator konten Indonesia yang ahli membuat ide video viral. Selalu respon dengan JSON valid, tanpa markdown atau backticks.';

function parseIdeas(content: string): string[] {
  console.log('[Suggest] Raw AI response:', content);
  let ideas: string[] = [];
  try {
    const parsed = JSON.parse(content);
    console.log('[Suggest] Parsed JSON:', parsed);
    if (Array.isArray(parsed)) {
      ideas = parsed.slice(0, 5);
    } else if (parsed.ideas && Array.isArray(parsed.ideas)) {
      ideas = parsed.ideas.slice(0, 5);
    } else if (parsed.data && Array.isArray(parsed.data)) {
      ideas = parsed.data.slice(0, 5);
    } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      ideas = parsed.suggestions.slice(0, 5);
    } else {
      const firstArray = Object.values(parsed).find(v => Array.isArray(v));
      if (firstArray) ideas = (firstArray as string[]).slice(0, 5);
    }
  } catch {
    console.log('[Suggest] JSON parse failed, trying fallback');
    ideas = content.split('\n')
      .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((l: string) => l.length > 5)
      .slice(0, 5);
  }
  console.log('[Suggest] Final ideas array:', ideas);
  return ideas;
}

async function fetchFromProvider(
  apiBase: string,
  apiKey: string,
  model: string,
  category: string,
  providerName: string
): Promise<{ ideas: string[] } | null> {
  try {
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(providerName === 'openrouter' ? { 'HTTP-Referer': process.env.APP_DOMAIN || 'http://localhost:3000' } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_MSG },
          { role: 'user', content: PROMPT(CATEGORY_NAMES[category]) },
        ],
        max_tokens: 500,
        temperature: 0.8,
        ...(providerName === 'groq' ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Suggest] ${providerName} error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errBody,
        model,
      });
      if (response.status === 429) {
        console.log(`[Suggest] ${providerName} rate limited (429), akan fallback`);
        return null;
      }
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const ideas = parseIdeas(content);
    return { ideas };
  } catch (error) {
    console.error(`[Suggest] ${providerName} fetch error:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') || '';

  if (!category || !CATEGORY_NAMES[category]) {
    return NextResponse.json({ success: false, error: 'Kategori tidak valid' }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // Coba Groq dulu
  if (groqKey) {
    console.log(`[Suggest] Mencoba Groq (${GROQ_MODEL})...`);
    const result = await fetchFromProvider(
      GROQ_API_BASE, groqKey, GROQ_MODEL, category, 'groq'
    );
    if (result && result.ideas.length > 0) {
      return NextResponse.json({ success: true, ideas: result.ideas });
    }
    console.log('[Suggest] Groq gagal atau kosong');
  } else {
    console.log('[Suggest] GROQ_API_KEY tidak ditemukan');
  }

  // Fallback ke OpenRouter
  if (openrouterKey) {
    // Coba model utama dulu
    console.log(`[Suggest] Fallback ke OpenRouter (${OPENROUTER_MODEL})...`);
    let result = await fetchFromProvider(
      OPENROUTER_API_BASE, openrouterKey, OPENROUTER_MODEL, category, 'openrouter'
    );
    if (result && result.ideas.length > 0) {
      return NextResponse.json({ success: true, ideas: result.ideas });
    }

    // Jika 404, fallback ke auto-router
    console.log(`[Suggest] OpenRouter model ${OPENROUTER_MODEL} gagal, fallback ke ${OPENROUTER_FALLBACK_MODEL}...`);
    result = await fetchFromProvider(
      OPENROUTER_API_BASE, openrouterKey, OPENROUTER_FALLBACK_MODEL, category, 'openrouter'
    );
    if (result && result.ideas.length > 0) {
      return NextResponse.json({ success: true, ideas: result.ideas });
    }

    console.log('[Suggest] OpenRouter juga gagal');
    return NextResponse.json(
      { success: false, error: 'Semua provider AI gagal' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { success: false, error: 'GROQ_API_KEY dan OPENROUTER_API_KEY tidak tersedia' },
    { status: 503 }
  );
}