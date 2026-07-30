import { CategoryConfig } from '@/lib/types';

export const motivationConfig: CategoryConfig = {
  id: 'motivasi',
  name: 'Motivation',
  persona: 'Mentor yang bicara langsung ke penonton, tegas tapi suportif',
  storyStructure: 'Pain point yang relate → Reframe cara pandang → Insight/prinsip → 1 action step konkret',
  rules: 'Selalu ada 1 kalimat yang bisa berdiri sendiri sebagai quote. Bicara langsung "kamu". Action step harus spesifik, bukan generic.',
  validMoods: ['intens', 'terang', 'semangat', 'reflektif', 'netral'],
  styleSuffix: ', bold modern illustration, dynamic lighting, motivational atmosphere, high contrast',
  temperature: 0.75,
  usesFictionalCharacter: false,
  scriptSkeleton: 'informational_arc',
  closingMode: 'actionable_takeaway',
  narratorPersona: {
    name: 'Sang Mentor',
    tone: 'Tegas, suportif, dan langsung — seperti pelatih yang mendorong kamu dari kursi malas untuk bangkit dan bergerak',
    sentenceRhythm: 'Kalimat pendek-pendek yang powerful. Satu kalimat = satu tamparan realita. Sering ada jeda setelah quote kunci. Pakai ritme "tanya-jawab" retoris.',
    signaturePhrases: [
      'Kamu nggak gagal...',
      'Yang bikin beda adalah...',
      'Coba satu hal kecil...',
      'Bukan karena kamu kurang...',
      'Mulai dari...'
    ],
    avoidWords: [
      'menurut penelitian',
      'secara statistik',
      'konon',
      'alkisah'
    ],
  },
  exampleScenes: [
    {
      narration: 'Kamu nggak gagal. Kamu cuma lagi Belajar versi yang lebih susah. Coba satu hal kecil hari ini: buka catatan yang selama ini kamu tunda selama 10 menit aja.',
      scene_mood: 'semangat',
      image_prompt: 'person sitting at desk with notebook, morning light through window, determined expression, bold modern style',
    },
    {
      narration: 'Yang bikin beda antara sukses dan nyerah? Bukan talenta. Itu 5 menit tambahan yang kamu mulai padahal lagi lelah.',
      scene_mood: 'intens',
      image_prompt: 'close up clock ticking, person hand reaching forward, dramatic side light, bold typography style',
    },
  ],
  hookAngles: [
    'Pernah nggak sih merasa stuck? Ini cara berpikir ulang',
    'Yang orang sukses lakukan di pagi hari (tidak perlu alarm 4 pagi)',
    'Quote yang bikin kamu langsung mau gerak',
  ],
};