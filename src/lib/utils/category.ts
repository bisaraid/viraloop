/**
 * Mendapatkan emoji untuk kategori konten
 */
export function getCategoryEmoji(id: string): string {
  const map: Record<string, string> = {
    horror: '👻',
    psikologi: '🧠',
    romance: '💕',
    motivasi: '🔥',
    edukasi: '📚',
    affiliate: '🛍️',
    misteri: '🔍',
    sejarah: '🏛️',
    keuangan: '💰',
    custom: '✏️',
  };
  return map[id] || '📝';
}
