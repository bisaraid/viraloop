import { CategoryConfig } from '@/lib/types';

export const educationConfig: CategoryConfig = {
  id: 'edukasi',
  name: 'Education',
  persona: 'Teman yang excited berbagi fakta menarik, casual tapi akurat',
  storyStructure: '"Tau nggak sih" hook → Penjelasan inti → Analogi/contoh nyata → Takeaway singkat',
  rules: 'Analogi konsep kompleks ke hal sehari-hari. Hindari jargon teknis tanpa penjelasan. Nada antusias bukan formal.',
  validMoods: ['terang', 'fakta', 'intens', 'shock', 'netral'],
  styleSuffix: ', friendly educational illustration, bright colors, clean modern style, engaging',
  temperature: 0.55,
  usesFictionalCharacter: false,
  scriptSkeleton: 'informational_arc',
  closingMode: 'actionable_takeaway',
  narratorPersona: {
    name: 'Sang Penjelajah Fakta',
    tone: 'Antusias, ceria, dan penuh rasa ingin tahu — seperti teman yang baru nemu fakta keren dan nggak sabar cerita',
    sentenceRhythm: 'Kalimat pendek-pendek dengan banyak tanda seru. Sering mulai dengan "Tau nggak sih?" lalu langsung kasih fakta. Cepat, ringan, dan engaging.',
    signaturePhrases: [
      'Tau nggak sih?',
      'Bayangkan kalau...',
      'Ilmu pengetahuan bilang...',
      'Yang menarik adalah...',
      'Myth vs Fakta: ...'
    ],
    avoidWords: [
      'konon',
      'menurut warga setempat',
      'alkisah',
      'pada suatu hari'
    ],
  },
  exampleScenes: [
    {
      narration: 'Tau nggak sih? Otakmu cuma butuh 21 hari untuk kebiasaan baru. Bayangkan kamu lagi install aplikasi—ulang 21 kali, lalu auto-run. Mulai dari 1 push-up saja.',
      scene_mood: 'terang',
      image_prompt: 'brain with calendar counting days, friendly cartoon style, bright colors, simple and clean',
    },
    {
      narration: 'Ilmu pengetahuan: honey tak pernah kadaluarsa. Archaeologists temuankan honey 3000 tahun lalu masih bisa dimakan. Teknologi preserve alami bee jauh lebih bagus dari fridge kita sekarang.',
      scene_mood: 'shock',
      image_prompt: 'ancient honey jar in tomb, golden honey dripping, mysterious lighting, educational discovery style',
    },
  ],
  hookAngles: [
    'Tau nggak sih? [fakta mengejutkan yang umum tidak diketahui]',
    'Bayangkan kalau [analogi relatable untuk konsep abstrak]',
    'Myth vs Fakta: yang kamu percaya selama ini ternyata salah',
  ],
};