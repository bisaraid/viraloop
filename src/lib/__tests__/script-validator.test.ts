import { describe, it, expect } from 'vitest';
import { validateSceneMood, parseScriptJson, validateClosingScene } from '../script-validator';
import type { Scene, CategoryConfig } from '../types';

describe('validateSceneMood', () => {
  const validMoods = ['misterius', 'mencekam', 'gelap', 'intens', 'shock', 'sunyi', 'lega'];

  it('should return exact match when mood is in valid list', () => {
    const result = validateSceneMood('mencekam', validMoods);
    expect(result).toBe('mencekam');
  });

  it('should be case insensitive', () => {
    const result = validateSceneMood('MENCEKAM', validMoods);
    expect(result).toBe('mencekam');
  });

  it('should trim whitespace', () => {
    const result = validateSceneMood('  gelap  ', validMoods);
    expect(result).toBe('gelap');
  });

  it('should map synonyms correctly', () => {
    const result = validateSceneMood('seram', validMoods);
    expect(result).toBe('mencekam');
  });

  it('should use fuzzy match for typos (Levenshtein <= 3)', () => {
    const result = validateSceneMood('mencekm', validMoods); // typo: missing 'a'
    expect(result).toBe('mencekam');
  });

  it('should fallback to default mood when no match', () => {
    const result = validateSceneMood('randomxyz', validMoods, 'gelap');
    expect(result).toBe('gelap');
  });

  it('should fallback to first valid mood when no default given', () => {
    const result = validateSceneMood('randomxyz', validMoods);
    expect(result).toBe(validMoods[0]);
  });
});

describe('parseScriptJson', () => {
  it('should parse valid JSON with scenes array', () => {
    const input = JSON.stringify({
      scenes: [
        { narration: 'Test', scene_mood: 'gelap', image_prompt: 'test', is_hook: true },
      ],
    });
    const result = parseScriptJson(input);
    expect(result).not.toBeNull();
    expect(result!.scenes).toHaveLength(1);
    expect(result!.scenes[0].narration).toBe('Test');
  });

  it('should return null if scenes is missing', () => {
    const input = JSON.stringify({ foo: 'bar' });
    const result = parseScriptJson(input);
    expect(result).toBeNull();
  });

  it('should extract JSON from markdown code block', () => {
    const input = '```json\n{"scenes": [{"narration": "Test", "scene_mood": "gelap", "image_prompt": "test", "is_hook": false}]}\n```';
    const result = parseScriptJson(input);
    expect(result).not.toBeNull();
    expect(result!.scenes).toHaveLength(1);
  });

  it('should return null for invalid input', () => {
    const result = parseScriptJson('not json at all');
    expect(result).toBeNull();
  });
});

describe('validateClosingScene', () => {
  it('should pass valid closing scene with is_conclusion and meaningful narration', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'Coba lakukan teknik 5 detik ini sebelum ngomong: tarik napas, tahan, lalu bicara. Dijamin kamu lebih pede.', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when last scene lacks is_conclusion', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'Narasi penutup', scene_mood: 'terang', image_prompt: 'test', is_hook: false },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scene terakhir tidak ditandai is_conclusion=true');
  });

  it('should fail when closing scene has empty narration', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: '', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scene closing memiliki narasi kosong');
  });

  it('should fail when closing scene is too short (< 30 chars)', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'Sekian', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('terlalu pendek'))).toBe(true);
  });

  it('should fail when closing scene starts with generic phrase and has no concrete element', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'itulah tadi cerita tentang fenomena ini', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scene closing diawali frasa generic tanpa elemen konkret (angka/aksi/rekomendasi)');
  });

  it('should pass when closing starts with generic phrase but has concrete element (angka)', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'itulah tadi 3 cara yang bisa kamu coba mulai besok pagi', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass when closing starts with generic phrase but has concrete element (kata kerja aksi)', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'fakta', image_prompt: 'test', is_hook: false },
      { narration: 'itulah tadi cara mengatur keuangan. Coba mulai dengan menabung 10% dari gaji.', scene_mood: 'terang', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when scenes array is empty', () => {
    const scenes: Scene[] = [];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Tidak ada scene sama sekali');
  });

  it('should pass valid cliffhanger closing scene', () => {
    const scenes: Scene[] = [
      { narration: 'Scene biasa', scene_mood: 'mencekam', image_prompt: 'test', is_hook: false },
      { narration: 'Pintu itu terbuka perlahan. Tapi yang keluar bukan manusia. Mau tahu apa yang terjadi selanjutnya? Follow biar nggak ketinggalan.', scene_mood: 'misterius', image_prompt: 'test', is_hook: false, is_conclusion: true },
    ];
    const result = validateClosingScene(scenes);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
