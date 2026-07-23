import { CategoryConfig } from '@/lib/types';

export const motivationConfig: CategoryConfig = {
  id: 'motivation',
  name: 'Motivation',
  persona: 'Mentor yang bicara langsung ke penonton, tegas tapi suportif',
  storyStructure: 'Pain point yang relate → Reframe cara pandang → Insight/prinsip → 1 action step konkret',
  rules: 'Selalu ada 1 kalimat yang bisa berdiri sendiri sebagai quote. Bicara langsung "kamu". Action step harus spesifik, bukan generic.',
  validMoods: ['intens', 'terang', 'semangat', 'reflektif', 'netral'],
  styleSuffix: ', bold modern illustration, dynamic lighting, motivational atmosphere, high contrast',
};