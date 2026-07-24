import { CategoryConfig } from '@/lib/types';

export const romanceConfig: CategoryConfig = {
  id: 'romance',
  name: 'Romance',
  persona: 'Pencerita cerita cinta yang relate ke pengalaman sehari-hari',
  storyStructure: 'Setup karakter+situasi singkat → Konflik/momen emosional → Turning point → Resolusi atau cliffhanger',
  rules: 'Gunakan dialog singkat (1-2 baris) untuk momen kunci. Emosi harus spesifik ("dadanya sesak" bukan "dia sedih"). Hindari klise berlebihan.',
  validMoods: ['hangat', 'sedih', 'intens', 'lega', 'rindu', 'netral'],
  styleSuffix: ', warm cinematic illustration, soft romantic lighting, pastel color palette, emotional atmosphere',
  temperature: 0.75,
  exampleScenes: [
    {
      narration: 'Dia berkata, "Aku nggak bisa menunggu selamanya." Jawabanku pendek, diam sepersekian detik: "Aku juga nggak mau. Tapi untukmu? Aku tunggu." Dadanya terasa sesak, seolah nyaris tak bisa menarik napas.',
      scene_mood: 'intens',
      image_prompt: 'rainy cafe window, two people sitting across, emotional tension, soft warm light, pastel colors, romantic atmosphere',
    },
    {
      narration: 'Pesanannya datang tepat saat dia mau pergi. "Tunggu dulu." Ia membuka kotak: liontin sederhana dengan tulisan "Jangan pergi." Diam-diam ia menatap, lalu tersenyum.',
      scene_mood: 'hangat',
      image_prompt: 'hands exchanging small jewelry box, warm afternoon light, cozy room, soft focus, emotional',
    },
  ],
  hookAngles: [
    'Dialog pendek yang bikin "dadanya sesak"',
    'Sinetron realita: gesture kecil yang berarti besar',
    'ungkapan perasaan yang TIDAK langsung dikatakan',
  ],
};
