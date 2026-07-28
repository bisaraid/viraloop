import { CategoryConfig } from '@/lib/types';

export const misteriConfig: CategoryConfig = {
  id: 'misteri',
  name: 'Misteri & Konspirasi',
  persona: 'Narator investigatif yang bahas kasus tak terpecahkan, fenomena aneh, dan teori konspirasi dengan gaya dongeng modern yang bikin merinding',
  storyStructure: 'Hook misterius (pertanyaan terbuka) → Paparan fenomena/kasus → Fakta-fakta yang bikin penasaran → Teori yang beredar → Kesimpulan open-ended (tanpa klaim mutlak)',
  rules: 'JANGAN sebut nama individu/kasus kriminal nyata yang masih sensitif atau berpotensi pencemaran nama baik. Fokus ke fenomena/misteri yang sudah lama dan general — bukan berita kriminal terkini. Gunakan frasa "menurut teori yang beredar", "banyak yang percaya", "belum terpecahkan hingga kini". Jangan klaim 100% fakta untuk hal yang belum terverifikasi.',
  validMoods: ['misterius', 'intens', 'gelap', 'shock', 'netral', 'fakta'],
  styleSuffix: ', mysterious investigative illustration, dark atmospheric lighting, cinematic conspiracy aesthetic, shadowy figures, indonesian setting',
  temperature: 0.75,
  exampleScenes: [
    {
      narration: 'Ada satu pulau di Indonesia yang bikin para ilmuwan bingung. Bukan karena monsternya—tapi karena nggak ada satu pun teori yang bisa menjelaskan kenapa ratusan orang menghilang di sana dalam 10 tahun terakhir. Polisi? Mereka menolak datang.',
      scene_mood: 'misterius',
      image_prompt: 'dark island silhouette at night, fog rolling over trees, abandoned dock, mysterious atmosphere, cinematic lighting',
    },
    {
      narration: 'Teori konspirasi bilang: ini bukan kecelakaan. Ini uji coba. Yang aneh? Semua saksi mata yang selamat... lupa persis apa yang mereka lihat. Iluminati? Alien? Atau sesuatu yang lebih dekat dari yang kita kira?',
      scene_mood: 'gelap',
      image_prompt: 'shadowy figures in dark room, projector screen with blurred images, conspiracy theory mood, muted colors',
    },
  ],
  hookAngles: [
    'Fenomena ini nggak bisa dijelaskan sains—sampai sekarang',
    'Teori konspirasi yang ternyata... benar?',
    'Misteri terbesar Indonesia yang belum terpecahkan',
    'Apa yang sebenarnya terjadi di [tempat misterius]?',
  ],
};