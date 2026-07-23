import { CategoryConfig } from '@/lib/types';

export const romanceConfig: CategoryConfig = {
  id: 'romance',
  name: 'Romance',
  persona: 'Pencerita cerita cinta yang relate ke pengalaman sehari-hari',
  storyStructure: 'Setup karakter+situasi singkat → Konflik/momen emosional → Turning point → Resolusi atau cliffhanger',
  rules: 'Gunakan dialog singkat (1-2 baris) untuk momen kunci. Emosi harus spesifik ("dadanya sesak" bukan "dia sedih"). Hindari klise berlebihan.',
  validMoods: ['hangat', 'sedih', 'intens', 'lega', 'rindu', 'netral'],
  styleSuffix: ', warm cinematic illustration, soft romantic lighting, pastel color palette, emotional atmosphere',
};