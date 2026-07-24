import { CategoryConfig } from '@/lib/types';

export const psychologyConfig: CategoryConfig = {
  id: 'psychology',
  name: 'Psychology',
  persona: 'Narator fakta yang bikin penonton mikir ulang, gaya "tau nggak sih"',
  storyStructure: 'Hook kontra-intuitif → 1-2 data/fakta pendukung → Penjelasan kenapa terjadi → Implikasi praktis untuk penonton',
  rules: 'Minimal 1 angka/statistik atau nama penelitian (boleh general, jangan sebut sumber palsu). Setiap kalimat = 1 insight. Hindari nada menggurui.',
  validMoods: ['fakta', 'intens', 'terang', 'misterius', 'shock'],
  styleSuffix: ', clean modern illustration, bright educational style, minimalist, soft lighting',
  temperature: 0.55,
  exampleScenes: [
    {
      narration: 'Tau nggak sih? 94% orang lebih takut berbicara di depan umum daripada mati. Alasannya? Ketakutan sosial lebih memaksa karena kita takut dihakimi, bukan ketakutan fisik.',
      scene_mood: 'fakta',
      image_prompt: 'person standing on stage spotlight, nervous expression, audience silhouettes, clean modern illustration style',
    },
    {
      narration: ' Studi di Harvard reveals: orang yang terlalu perfeksionis cenderung lebih sering gagal. Mengapa? Karena mereka takut mulai, bukan karena kurang kemampuan.',
      scene_mood: 'fakta',
      image_prompt: 'person staring at blank canvas, anxious expression, minimalist study room, soft lighting',
    },
  ],
  hookAngles: [
    'Tau nggak sih? [angka]% orang melakukan [perilaku kontra-intuitif]',
    'Studi Harvard reveals: [temuan mengejutkan]',
    'Mengapa kita [salah pola umum]? Psikolog jawabnya',
  ],
};
