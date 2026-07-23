/**
 * API Key Rotation untuk TTS providers
 *
 * Load semua key dari env vars dengan pola:
 *   {PREFIX}_API_KEY_1, {PREFIX}_VOICE_ID_1
 *   {PREFIX}_API_KEY_2, {PREFIX}_VOICE_ID_2
 *   ... dst (sampai index N yang tidak ketemu)
 *
 * Strategi: random selection tiap request (cocok untuk Vercel serverless
 * karena counter round-robin tidak persistent antar instance).
 *
 * Jika request gagal (401/429), retry dengan key lain.
 * Jika semua key gagal, throw error.
 */

export interface ProviderKey {
  apiKey: string;
  voiceId?: string;
  index: number;
}

/**
 * Load semua key yang tersedia untuk suatu provider
 * Loop dari index 1 sampai tidak ketemu env var berikutnya
 */
export function loadProviderKeys(prefix: string): ProviderKey[] {
  const keys: ProviderKey[] = [];
  let index = 1;

  while (true) {
    const apiKey = process.env[`${prefix}_API_KEY_${index}`];
    if (!apiKey) break; // Stop jika tidak ada key lagi

    const voiceId = process.env[`${prefix}_VOICE_ID_${index}`];
    keys.push({ apiKey, voiceId, index });
    index++;
  }

  return keys;
}

/**
 * Pilih key secara random dari array
 */
export function getRandomKey(keys: ProviderKey[]): ProviderKey | undefined {
  if (keys.length === 0) return undefined;
  const idx = Math.floor(Math.random() * keys.length);
  return keys[idx];
}

/**
 * Coba execute function dengan key rotation
 *
 * @param keys - Array of ProviderKey
 * @param fn - Function yang menerima apiKey dan voiceId, return Promise<T>
 * @returns Result dari fn
 * @throws Error jika semua key gagal
 */
export async function executeWithRotation<T>(
  keys: ProviderKey[],
  fn: (apiKey: string, voiceId?: string) => Promise<T>
): Promise<T> {
  if (keys.length === 0) {
    throw new Error('Tidak ada API key yang tersedia');
  }

  // Shuffle keys untuk random order
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const errors: string[] = [];

  for (const key of shuffled) {
    try {
      const result = await fn(key.apiKey, key.voiceId);
      return result;
    } catch (error) {
      const status = extractStatus(error);
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Key #${key.index}: ${msg}`);

      // Hanya retry jika error 401 (unauthorized) atau 429 (rate limit)
      // Untuk error lain (500, timeout, dll) langsung throw
      if (status !== 401 && status !== 429) {
        throw error;
      }

      console.warn(`[KeyRotator] Key #${key.index} gagal (${status}), coba key lain...`);
    }
  }

  throw new Error(`Semua API key gagal:\n${errors.join('\n')}`);
}

/**
 * Extract HTTP status code dari error message
 */
function extractStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/\((\d+)\)/);
  if (match) return parseInt(match[1], 10);
  return null;
}