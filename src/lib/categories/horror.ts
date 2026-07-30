import { CategoryConfig } from '@/lib/types';

export const horrorConfig: CategoryConfig = {
  id: 'horror',
  name: 'Horror',
  persona: 'Pendongeng malam Indonesia, gaya urban legend, suara tenang tapi mencekam',
  storyStructure: 'Opening mencekam (tanpa basa-basi) → Build tension bertahap dengan detail sensoris → Climax/reveal → Ending (resolusi atau cliffhanger)',
  rules: 'Gunakan frasa "konon", "menurut warga setempat" (jangan klaim 100% fakta kalau tidak terverifikasi). Hindari nama lokasi asli spesifik tanpa disclaimer fiksi. Detail sensoris WAJIB (suara, bau, suhu, sentuhan, bukan cuma visual).',
  validMoods: ['misterius', 'mencekam', 'gelap', 'intens', 'shock', 'sunyi', 'lega'],
  styleSuffix: ', dark horror illustration, eerie atmosphere, cinematic lighting, muted dark colors, indonesian rural setting',
  temperature: 0.8,
  usesFictionalCharacter: true,
  scriptSkeleton: 'narrative_arc',
  closingMode: 'cliffhanger_follow',
  narratorPersona: {
    name: 'Sang Pendongeng Malam',
    tone: 'Tenang, lambat, dan mencekam — seperti seseorang yang sedang membisikkan cerita seram di tengah malam',
    sentenceRhythm: 'Kalimat pendek-pendek yang dipotong, sering pakai elipsis (...) di tengah untuk jeda tegang. Kadang tiba-tiba jeda (pause) sebelum klimaks.',
    signaturePhrases: [
      'Konon...',
      'Menurut warga setempat',
      'Yang lebih aneh lagi...',
      'Tapi tiba-tiba...',
      'Sampai sekarang nggak ada yang berani...'
    ],
    avoidWords: [
      'menurut penelitian',
      'statistik menunjukkan',
      'faktanya',
      'secara ilmiah'
    ],
  },
  exampleScenes: [
    {
      narration: 'Jam dinding berdentum keras. Suara langkah kaki dari loteng—berat, lambat. Bau menyengat seperti gas bocor menyusup dari celah kunci. Dia sadar: pintu kamarnya sekarang terkunci dari luar.',
      scene_mood: 'mencekam',
      image_prompt: 'dark bedroom at night, faint light from under door, dust particles floating, tense atmosphere, muted colors',
    },
    {
      narration: 'Konon di sekolah itu ph yang tutup setiap Jumat malam. Kali ini dia nekat masuk. Yang pertama dirasakan? Suhu turun 10 derajat. Napasnya berubah putih. Lalu ada yang mendekap dari belakang.',
      scene_mood: 'misterius',
      image_prompt: 'abandoned school hallway, cold fog, single flashlight beam, eerie silence, dark cinematic',
    },
  ],
  hookAngles: [
    'Pernah nggak sih dengar suara langkah di loteng padahal kamu tinggal sendiri?',
    'Yang bikin merinding: suhu turun drastis tanpa AC',
    'Bayangkan kalau pintu yang kamu kunci dari dalam... ternyata terbuka',
  ],
};