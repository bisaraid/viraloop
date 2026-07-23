import { CategoryConfig } from '@/lib/types';

export const educationConfig: CategoryConfig = {
  id: 'education',
  name: 'Education',
  persona: 'Teman yang excited berbagi fakta menarik, casual tapi akurat',
  storyStructure: '"Tau nggak sih" hook → Penjelasan inti → Analogi/contoh nyata → Takeaway singkat',
  rules: 'Analogi konsep kompleks ke hal sehari-hari. Hindari jargon teknis tanpa penjelasan. Nada antusias bukan formal.',
  validMoods: ['terang', 'fakta', 'intens', 'shock', 'netral'],
  styleSuffix: ', friendly educational illustration, bright colors, clean modern style, engaging',
};