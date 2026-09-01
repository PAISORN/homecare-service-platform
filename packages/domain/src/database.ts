import type { Tables } from '@homecare/database-types';

/**
 * Canonical category identifiers persisted in service_categories.code.
 * Keep UI and scaffold data on this boundary instead of inventing aliases.
 */
export const serviceCategoryCodes = [
  'AIR-CONDITIONING',
  'PLUMBING',
  'ELECTRICAL',
] as const;

export type ServiceCategoryCode = (typeof serviceCategoryCodes)[number];

export type ServiceCategoryRecord = Omit<
  Tables<'service_categories'>,
  'code'
> & {
  code: ServiceCategoryCode;
};

export function isSupportedServiceCategory(
  value: string,
): value is ServiceCategoryCode {
  return serviceCategoryCodes.some((code) => code === value);
}
