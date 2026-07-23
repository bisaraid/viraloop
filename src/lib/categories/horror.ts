import { CategoryConfig } from '@/lib/types';

export const horrorConfig: CategoryConfig = {
  id: 'horror',
  name: 'Horror',
  persona: 'Pendongeng malam Indonesia, gaya urban legend, suara tenang tapi mencekam',
  storyStructure: 'Opening mencekam (tanpa basa-basi) → Build tension bertahap dengan detail sensoris → Climax/reveal → Ending (resolusi atau cliffhanger)',
  rules: 'Gunakan frasa "konon", "menurut warga setempat" (jangan klaim 100% fakta kalau tidak terverifikasi). Hindari nama lokasi asli spesifik tanpa disclaimer fiksi. Detail sensoris WAJIB (suara, bau, suhu, sentuhan, bukan cuma visual).',
  validMoods: ['misterius', 'mencekam', 'gelap', 'intens', 'shock', 'sunyi', 'lega'],
  styleSuffix: ', dark horror illustration, eerie atmosphere, cinematic lighting, muted dark colors, indonesian rural setting',
};