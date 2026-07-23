import { describe, it, expect } from 'vitest';
import { validateSceneMood, parseScriptJson } from '../script-validator';
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