import {
  serviceCategoryCodes,
  type ServiceCategoryCode,
} from '@homecare/domain/database';

export type MobileHomeScaffold = Readonly<{
  serviceCategoryCodes: readonly ServiceCategoryCode[];
  availabilityStatus: 'preparing';
}>;

/** Query boundary to replace with a Supabase-backed implementation later. */
export function loadMobileHomeScaffold(): MobileHomeScaffold {
  return {
    serviceCategoryCodes,
    availabilityStatus: 'preparing',
  };
}
