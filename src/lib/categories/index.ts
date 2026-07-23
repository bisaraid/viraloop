import { CategoryConfig, CategoryId } from '@/lib/types';
import { horrorConfig } from './horror';
import { psychologyConfig } from './psychology';
import { romanceConfig } from './romance';
import { motivationConfig } from './motivation';
import { educationConfig } from './education';
import { affiliateConfig } from './affiliate';

const categoryMap: Record<CategoryId, CategoryConfig> = {
  horror: horrorConfig,
  psychology: psychologyConfig,
  romance: romanceConfig,
  motivation: motivationConfig,
  education: educationConfig,
  affiliate: affiliateConfig,
};

export const allCategories: CategoryConfig[] = Object.values(categoryMap);

export function getCategoryConfig(id: CategoryId): CategoryConfig {
  return categoryMap[id];
}

export { horrorConfig, psychologyConfig, romanceConfig, motivationConfig, educationConfig, affiliateConfig };