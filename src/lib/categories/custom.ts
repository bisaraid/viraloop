import { CategoryConfig } from '@/lib/types';

/**
 * Custom category — menerima nama niche sebagai parameter dinamis.
 * Tidak ada data crawl untuk kategori ini, getTopHooks() akan return [].
 * hookAngles menggunakan set GENERIK yang applicable ke niche apapun.
 */
export function createCustomConfig(nicheName: string): CategoryConfig {
  return {
    id: 'custom',
    name: `Custom: ${nicheName}`,
    persona: `Kamu adalah penulis script video pendek bahasa Indonesia untuk niche ${nicheName}. Sesuaikan gaya bahasa dan tone dengan topik ini secara natural. Gunakan referensi yang relevan dengan dunia ${nicheName} agar konten terasa autentik dan tidak generic.`,
    storyStructure: 'Hook yang relevan dengan topik → Pembahasan inti (2-3 poin kunci) → Contoh/aplikasi nyata → Kesimpulan/Call-to-action',
    rules: 'Sesuaikan gaya bahasa dengan topik yang dipilih. Jangan memaksakan gaya yang tidak cocok dengan niche. Pastikan konten informatif dan engaging. Hindari klaim yang tidak bisa diverifikasi. Gunakan bahasa Indonesia yang natural sesuai konteks niche.',
    validMoods: ['terang', 'fakta', 'intens', 'semangat', 'netral', 'reflektif'],
    styleSuffix: ', clean modern illustration style, bright engaging atmosphere, relevant visual metaphor for the topic, minimalist design',
    temperature: 0.7,
    exampleScenes: [
      {
        narration: `Bicara soal ${nicheName}, ada satu hal yang jarang diketahui orang. Bukan karena nggak penting—tapi karena informasinya tersebar di banyak tempat. Yuk kita bedah satu per satu.`,
        scene_mood: 'terang',
        image_prompt: `clean illustration representing ${nicheName} topic, bright modern style, engaging visual metaphor, minimalist design`,
      },
      {
        narration: `Yang bikin ${nicheName} ini menarik? Bukan cuma tren sesaat. Tapi ada pola yang konsisten terjadi. Dan kalau kamu paham polanya, kamu bisa dapat manfaat jangka panjang.`,
        scene_mood: 'fakta',
        image_prompt: `pattern visualization related to ${nicheName}, clean infographic style, bright colors, educational modern design`,
      },
    ],
    hookAngles: [
      'Hal sepele soal [topik] yang ternyata penting banget',
      'Pernah nggak sih mikir: kenapa [fenomena terkait topik] bisa terjadi?',
      'Yang jarang dibahas soal [topik] padahal impactful',
      'Kesalahan umum soal [topik] yang sering dilakukan',
      'Fakta menarik seputar [topik] yang bikin kamu mikir ulang',
    ],
  };
}