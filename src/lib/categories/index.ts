import { CategoryConfig, CategoryId } from '@/lib/types';
import { horrorConfig } from './horror';
import { psychologyConfig } from './psychology';
import { romanceConfig } from './romance';
import { motivationConfig } from './motivation';
import { educationConfig } from './education';
import { affiliateConfig } from './affiliate';
import { misteriConfig } from './misteri';
import { sejarahConfig } from './sejarah';
import { keuanganConfig } from './keuangan';
import { createCustomConfig } from './custom';

const categoryMap: Record<CategoryId, CategoryConfig> = {
  horror: horrorConfig,
  psikologi: psychologyConfig,
  romance: romanceConfig,
  motivasi: motivationConfig,
  edukasi: educationConfig,
  affiliate: affiliateConfig,
  misteri: misteriConfig,
  sejarah: sejarahConfig,
  keuangan: keuanganConfig,
  custom: createCustomConfig(''), // placeholder, will be overridden when used via getCustomCategoryConfig()
};

export const allCategories: CategoryConfig[] = Object.values(categoryMap);

export function getCategoryConfig(id: CategoryId): CategoryConfig {
  return categoryMap[id];
}

export function getCustomCategoryConfig(nicheName: string): CategoryConfig {
  return createCustomConfig(nicheName);
}

export { horrorConfig, psychologyConfig, romanceConfig, motivationConfig, educationConfig, affiliateConfig, misteriConfig, sejarahConfig, keuanganConfig };