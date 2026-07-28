import { CategoryConfig } from '@/lib/types';

export const sejarahConfig: CategoryConfig = {
  id: 'sejarah',
  name: 'Sejarah',
  persona: 'Storyteller sejarah yang dramatis, membahas fakta sejarah tersembunyi dan detail jarang diketahui dengan gaya narasi epik tapi akurat secara historis',
  storyStructure: 'Hook menarik (fakta tersembunyi) → Setting konteks sejarah → Konflik/peristiwa kunci → Dampak/pengaruh ke masa kini → Takeaway reflektif',
  rules: 'WAJIB akurat secara historis — jangan mengarang fakta. Gunakan tahun, nama tokoh, dan lokasi yang benar. Boleh dramatisasi narasi tapi jangan mengubah fakta inti. Hindari klaim revisionis tanpa sumber. Sertakan perspektif Indonesia jika relevan.',
  validMoods: ['intens', 'fakta', 'terang', 'shock', 'netral', 'misterius'],
  styleSuffix: ', epic historical illustration style, dramatic lighting, vintage color palette, cinematic period atmosphere, indonesian historical setting',
  temperature: 0.7,
  exampleScenes: [
    {
      narration: 'Tau nggak sih? Indonesia punya perjanjian rahasia yang hampir mengubah peta dunia. Tahun 1824, Belanda dan Inggris bagi-bagi wilayah kayak bagi kue—tanpa ngomong ke kerajaan-kerajaan Nusantara. Akibatnya? Satu pulau terbelah dua, dan kita masih rasain dampaknya sampai sekarang.',
      scene_mood: 'fakta',
      image_prompt: 'vintage map of indonesian archipelago being divided by two colonial hands, dramatic lighting, sepia tones, historical illustration style',
    },
    {
      narration: 'Di balik kemerdekaan Indonesia, ada satu nama yang sengaja dihapus dari buku sejarah. Bukan Soekarno, bukan Hatta. Tapi seorang perempuan yang mendanai perjuangan dari hasil jualan batiknya. Namanya? Nyi Ageng Serang. Kenapa nggak banyak yang tahu?',
      scene_mood: 'misterius',
      image_prompt: 'vintage photograph of a strong javanese woman in traditional batik, heroic pose, warm golden light, historical documentary style',
    },
  ],
  hookAngles: [
    'Fakta sejarah Indonesia yang jarang diketahui',
    'Peristiwa yang dihapus dari buku sejarah',
    'Kalau [peristiwa] nggak terjadi, Indonesia bakal beda sekarang',
    'Tokoh sejarah yang terlupakan padahal jasanya besar',
  ],
};