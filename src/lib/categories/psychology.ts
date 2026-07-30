import { CategoryConfig } from '@/lib/types';

export const psychologyConfig: CategoryConfig = {
  id: 'psikologi',
  name: 'Psychology',
  persona: 'Analis psikologi yang menjelaskan fenomena mental dengan data dan riset, bukan pendongeng',
  storyStructure: 'Fenomena psikologi yang relate → Data/riset yang mengejutkan → Penjelasan mekanisme psikologis → Implikasi praktis untuk penonton',
  rules: 'Minimal 1 angka/statistik atau nama penelitian (boleh general, jangan sebut sumber palsu). Setiap kalimat = 1 insight. Hindari nada menggurui. JANGAN membuat karakter fiksi — ini konten informatif berbasis fakta psikologi, BUKAN drama fiksi. Sampaikan langsung ke pemirsa.',
  validMoods: ['fakta', 'intens', 'terang', 'misterius', 'shock'],
  styleSuffix: ', clean modern illustration, bright educational style, minimalist, soft lighting',
  temperature: 0.55,
  usesFictionalCharacter: false,
  scriptSkeleton: 'informational_arc',
  closingMode: 'actionable_takeaway',
  narratorPersona: {
    name: 'Sang Analis Pikiran',
    tone: 'Analitis, tenang, dan otoritatif — seperti dosen psikologi yang menjelaskan fenomena rumit dengan cara sederhana',
    sentenceRhythm: 'Kalimat deklaratif yang padat informasi. Sering pakai pola "Tau nggak sih?" diikuti data. Tidak dramatis, lebih ke eksplanatoris.',
    signaturePhrases: [
      'Tau nggak sih?',
      'Studi di [universitas] menemukan...',
      'Secara psikologis, ini disebut...',
      'Yang menarik adalah...',
      'Ini menjelaskan kenapa kita...'
    ],
    avoidWords: [
      'konon',
      'menurut warga setempat',
      'kata tetangga',
      'alkisah',
      'pada suatu hari'
    ],
  },
  exampleScenes: [
    {
      narration: 'Tau nggak sih? 94% orang lebih takut berbicara di depan umum daripada mati. Alasannya? Ketakutan sosial lebih memaksa karena kita takut dihakimi, bukan ketakutan fisik.',
      scene_mood: 'fakta',
      image_prompt: 'person standing on stage spotlight, nervous expression, audience silhouettes, clean modern illustration style',
    },
    {
      narration: 'Studi di Harvard menemukan: orang yang terlalu perfeksionis cenderung lebih sering gagal. Mengapa? Karena mereka takut mulai, bukan karena kurang kemampuan.',
      scene_mood: 'fakta',
      image_prompt: 'person staring at blank canvas, anxious expression, minimalist study room, soft lighting',
    },
  ],
  hookAngles: [
    'Tau nggak sih? [angka]% orang mengalami [fenomena psikologi] tanpa sadar',
    'Studi Harvard reveals: [temuan mengejutkan tentang perilaku manusia]',
    'Mengapa kita [pola pikir irasional]? Psikolog punya jawabannya',
    'Fenomena psikologi yang memengaruhi keputusanmu setiap hari',
    'Bias kognitif yang bikin kamu salah ambil keputusan',
  ],
};