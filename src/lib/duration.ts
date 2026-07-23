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

export const durationOptions = Object.values(durationConfigs);

export function getDurationConfig(id: DurationTier): DurationConfig {
  return durationConfigs[id];
}