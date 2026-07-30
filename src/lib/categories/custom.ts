import { CategoryConfig } from '@/lib/types';

/**
 * Custom category — menerima nama niche sebagai parameter dinamis.
 * Tidak ada data crawl untuk kategori ini, getTopHooks() akan return [].
 * hookAngles menggunakan set GENERIK yang applicable ke niche apapun.
 */
export function createCustomConfig(nicheName: string): CategoryConfig {
  const isFictional = false; // default: informatif, user bisa override via nicheName context
  return {
    id: 'custom',
    name: `Custom: ${nicheName || '(isi topik)'}`,
    persona: `Kamu adalah penulis script video pendek bahasa Indonesia untuk niche ${nicheName || '[topik]'}. Sesuaikan gaya bahasa dan tone dengan topik ini secara natural. Gunakan referensi yang relevan dengan dunia ${nicheName || '[topik]'} agar konten terasa autentik dan tidak generic.`,
    storyStructure: 'Hook yang relevan dengan topik → Pembahasan inti (2-3 poin kunci) → Contoh/aplikasi nyata → Kesimpulan/Call-to-action',
    rules: 'Sesuaikan gaya bahasa dengan topik yang dipilih. Jangan memaksakan gaya yang tidak cocok dengan niche. Pastikan konten informatif dan engaging. Hindari klaim yang tidak bisa diverifikasi. Gunakan bahasa Indonesia yang natural sesuai konteks niche.',
    validMoods: ['terang', 'fakta', 'intens', 'semangat', 'netral', 'reflektif'],
    styleSuffix: ', clean modern illustration style, bright engaging atmosphere, relevant visual metaphor for the topic, minimalist design',
    temperature: 0.7,
    usesFictionalCharacter: isFictional,
    scriptSkeleton: isFictional ? 'narrative_arc' : 'informational_arc',
    closingMode: isFictional ? 'cliffhanger_follow' : 'actionable_takeaway',
    narratorPersona: {
      name: `Sang Pembahas ${nicheName || 'Topik'}`,
      tone: 'Adaptif dan natural — menyesuaikan gaya bicara dengan topik yang dibahas, tetap engaging dan tidak kaku',
      sentenceRhythm: 'Mengalir natural sesuai topik. Hook di awal, lalu pembahasan poin per poin. Ada variasi ritme tergantung konten.',
      signaturePhrases: [
        'Bicara soal [topik]...',
        'Yang jarang diketahui...',
        'Bukan cuma tren sesaat...',
        'Kalau kamu paham polanya...',
      ],
      avoidWords: [
        'konon',
        'alkisah',
        'menurut warga setempat',
      ],
    },
    exampleScenes: [
      {
        narration: `Bicara soal ${nicheName || '[topik]'}, ada satu hal yang jarang diketahui orang. Bukan karena nggak penting—tapi karena informasinya tersebar di banyak tempat. Yuk kita bedah satu per satu.`,
        scene_mood: 'terang',
        image_prompt: `clean illustration representing ${nicheName || 'the topic'}, bright modern style, engaging visual metaphor, minimalist design`,
      },
      {
        narration: `Yang bikin ${nicheName || '[topik]'} ini menarik? Bukan cuma tren sesaat. Tapi ada pola yang konsisten terjadi. Dan kalau kamu paham polanya, kamu bisa dapat manfaat jangka panjang.`,
        scene_mood: 'fakta',
        image_prompt: `pattern visualization related to ${nicheName || 'the topic'}, clean infographic style, bright colors, educational modern design`,
      },
    ],
    hookAngles: [
      nicheName ? `Hal sepele soal ${nicheName} yang ternyata penting banget` : 'Hal sepele soal [topik] yang ternyata penting banget',
      nicheName ? `Pernah nggak sih mikir: kenapa ${nicheName} bisa terjadi?` : 'Pernah nggak sih mikir: kenapa [fenomena terkait topik] bisa terjadi?',
      nicheName ? `Yang jarang dibahas soal ${nicheName} padahal impactful` : 'Yang jarang dibahas soal [topik] padahal impactful',
      nicheName ? `Kesalahan umum soal ${nicheName} yang sering dilakukan` : 'Kesalahan umum soal [topik] yang sering dilakukan',
      nicheName ? `Fakta menarik seputar ${nicheName} yang bikin kamu mikir ulang` : 'Fakta menarik seputar [topik] yang bikin kamu mikir ulang',
    ],
  };
}