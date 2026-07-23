/**
 * Mendapatkan emoji untuk kategori konten
 */
export function getCategoryEmoji(id: string): string {
  const map: Record<string, string> = {
    horror: '👻',
    psychology: '🧠',
    romance: '💕',
    motivation: '🔥',
    education: '📚',
    affiliate: '🛍️',
  };
  return map[id] || '📝';
}