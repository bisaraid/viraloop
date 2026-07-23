import { CategoryConfig } from '@/lib/types';

export const psychologyConfig: CategoryConfig = {
  id: 'psychology',
  name: 'Psychology',
  persona: 'Narator fakta yang bikin penonton mikir ulang, gaya "tau nggak sih"',
  storyStructure: 'Hook kontra-intuitif → 1-2 data/fakta pendukung → Penjelasan kenapa terjadi → Implikasi praktis untuk penonton',
  rules: 'Minimal 1 angka/statistik atau nama penelitian (boleh general, jangan sebut sumber palsu). Setiap kalimat = 1 insight. Hindari nada menggurui.',
  validMoods: ['fakta', 'intens', 'terang', 'misterius', 'shock'],
  styleSuffix: ', clean modern illustration, bright educational style, minimalist, soft lighting',
};