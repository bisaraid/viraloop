import { CategoryConfig } from '@/lib/types';

export const affiliateConfig: CategoryConfig = {
  id: 'affiliate',
  name: 'Affiliate / Product Review',
  persona: 'Reviewer jujur yang benar-benar sudah pakai produknya',
  storyStructure: 'Problem yang produk ini solve → Fitur kunci (2-3 poin) → Bukti/hasil pemakaian → CTA jelas di akhir',
  rules: 'WAJIB sebut 1 kekurangan produk (kredibilitas, bukan promosi buta). CTA harus spesifik ("link di bio", "cek harga sekarang"). PENTING — generate review HARUS berdasarkan data aktual yang diinput user (deskripsi produk + ulasan), BUKAN karangan AI. Jangan generate klaim spek/harga yang tidak ada di input user.',
  validMoods: ['terang', 'intens', 'fakta', 'semangat', 'netral'],
  styleSuffix: ', clean product photography style, bright commercial lighting, modern minimalist background',
  temperature: 0.5,
  exampleScenes: [
    {
      narration: '3 dari 4 reviewer sebut baterai tahan 12 jam. Yang kurang? Kamera belum sejauh brand lain. Tapi kalau butuh HP murah tangguh, ini worth it. Link di bio buat lihat harga.',
      scene_mood: 'terang',
      image_prompt: 'hand holding phone with battery icon showing 12 hours, clean white background, product photography style',
    },
    {
      narration: 'HP ini bukanFlagship, tapi untuk sehari-hari cukup. Yang bikin saya jual beli? HargaRp 2,4 juta dapet RAM 8GB. Spesifikasi pasar.',
      scene_mood: 'fakta',
      image_prompt: 'smartphone spec sheet comparison, clean minimal layout, bright commercial lighting',
    },
  ],
  hookAngles: [
    'Pernah nggak sih beli HP tapi charge cuma sebentar?',
    'Yang nggak realistis: flagship price dengan mid-range spec',
    'Review polos tanpa hype: apakah ini worth it?',
  ],
};
