import { DurationConfig, DurationTier } from '@/lib/types';

export const durationConfigs: Record<DurationTier, DurationConfig> = {
  short: {
    id: 'short',
    label: 'Short (1-3 menit)',
    description: '150-350 kata, 5-8 scene',
    targetWords: 350,
    targetScenes: 8,
    segments: 1,
  },
  standard: {
    id: 'standard',
    label: 'Standard (5 menit)',
    description: '600-750 kata, 10-15 scene',
    targetWords: 750,
    targetScenes: 15,
    segments: 2,
  },
  long: {
    id: 'long',
    label: 'Long (15+ menit)',
    description: '2000-2500 kata, 30-40+ scene',
    targetWords: 2500,
    targetScenes: 40,
    segments: 5,
  },
};

/**
 * Konfigurasi durasi KHUSUS untuk kategori affiliate.
 * Tier berbeda dari kategori lain:
 * - short: 30 detik (~60-90 kata, 2-3 scene), 1 produk
 * - standard: 1 menit (~120-180 kata, 4-5 scene), 1 produk
 * - long: 3 menit (~350-450 kata, 8-10 scene), MODE PERBANDINGAN 2-3 produk
 */
export const affiliateDurationConfigs: Record<DurationTier, DurationConfig> = {
  short: {
    id: 'short',
    label: 'Short (30 detik)',
    description: '60-90 kata, 2-3 scene — 1 produk',
    targetWords: 90,
    targetScenes: 3,
    segments: 1,
  },
  standard: {
    id: 'standard',
    label: 'Standard (1 menit)',
    description: '120-180 kata, 4-5 scene — 1 produk',
    targetWords: 180,
    targetScenes: 5,
    segments: 1,
  },
  long: {
    id: 'long',
    label: 'Long (3 menit — Perbandingan)',
    description: '350-450 kata, 8-10 scene — 2-3 produk',
    targetWords: 450,
    targetScenes: 10,
    segments: 2,
  },
};

export const durationOptions = Object.values(durationConfigs);

export function getDurationConfig(id: DurationTier): DurationConfig {
  return durationConfigs[id];
}

/**
 * Ambil konfigurasi durasi PER KATEGORI.
 * Untuk affiliate, return config khusus (30 detik/1 menit/3 menit).
 * Untuk kategori lain, fallback ke getDurationConfig() yang lama.
 */
export function getDurationConfigForCategory(categoryId: string, id: DurationTier): DurationConfig {
  if (categoryId === 'affiliate') {
    return affiliateDurationConfigs[id];
  }
  return durationConfigs[id];
}