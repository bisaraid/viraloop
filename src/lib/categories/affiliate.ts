import { CategoryConfig } from '@/lib/types';

export const affiliateConfig: CategoryConfig = {
  id: 'affiliate',
  name: 'Affiliate / Product Review',
  persona: 'Reviewer jujur yang benar-benar sudah pakai produknya',
  storyStructure: 'Problem yang produk ini solve → Fitur kunci (2-3 poin) → Bukti/hasil pemakaian → CTA jelas di akhir',
  rules: 'WAJIB sebut 1 kekurangan produk (kredibilitas, bukan promosi buta). CTA harus spesifik ("link di bio", "cek harga sekarang"). PENTING — generate review HARUS berdasarkan data aktual yang diinput user (deskripsi produk + ulasan), BUKAN karangan AI. Jangan generate klaim spek/harga yang tidak ada di input user.',
  validMoods: ['terang', 'intens', 'fakta', 'semangat', 'netral'],
  styleSuffix: ', clean product photography style, bright commercial lighting, modern minimalist background',
  hasCustomInput: true,
  customInputLabel: 'Input URL Produk, Deskripsi Produk, dan Ulasan',
};