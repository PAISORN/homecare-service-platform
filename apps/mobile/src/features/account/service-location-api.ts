import type { Tables } from '@homecare/database-types';

import type { MobileSupabaseClient } from '../../lib/supabase';

export type ServiceLocation = Pick<
  Tables<'service_locations'>,
  | 'id'
  | 'label'
  | 'address_line'
  | 'building'
  | 'floor'
  | 'unit'
  | 'access_instructions'
  | 'latitude'
  | 'longitude'
  | 'is_default'
  | 'created_at'
  | 'updated_at'
>;

export type ServiceLocationDraft = Readonly<{
  label: string;
  addressLine: string;
  building: string;
  floor: string;
  unit: string;
  accessInstructions: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
}>;

export type ServiceLocationField =
  | 'label'
  | 'addressLine'
  | 'building'
  | 'floor'
  | 'unit'
  | 'accessInstructions';

export type ServiceLocationValidation = Readonly<{
  value: ServiceLocationDraft;
  errors: Readonly<
    Partial<Record<ServiceLocationField, 'required' | 'too_long'>>
  >;
}>;

export const emptyServiceLocationDraft: ServiceLocationDraft = {
  label: '',
  addressLine: '',
  building: '',
  floor: '',
  unit: '',
  accessInstructions: '',
  isDefault: false,
  latitude: null,
  longitude: null,
};

function trimmed(value: string) {
  return value.trim();
}

export function validateServiceLocationDraft(
  draft: ServiceLocationDraft,
): ServiceLocationValidation {
  const value = {
    ...draft,
    label: trimmed(draft.label),
    addressLine: trimmed(draft.addressLine),
    building: trimmed(draft.building),
    floor: trimmed(draft.floor),
    unit: trimmed(draft.unit),
    accessInstructions: trimmed(draft.accessInstructions),
  };
  const errors: Partial<Record<ServiceLocationField, 'required' | 'too_long'>> =
    {};

  if (!value.label) errors.label = 'required';
  else if (value.label.length > 80) errors.label = 'too_long';
  if (!value.addressLine) errors.addressLine = 'required';
  else if (value.addressLine.length > 500) errors.addressLine = 'too_long';
  if (value.building.length > 160) errors.building = 'too_long';
  if (value.floor.length > 40) errors.floor = 'too_long';
  if (value.unit.length > 40) errors.unit = 'too_long';
  if (value.accessInstructions.length > 500)
    errors.accessInstructions = 'too_long';

  return { value, errors };
}

export function serviceLocationToDraft(
  location: ServiceLocation,
): ServiceLocationDraft {
  return {
    label: location.label,
    addressLine: location.address_line,
    building: location.building ?? '',
    floor: location.floor ?? '',
    unit: location.unit ?? '',
    accessInstructions: location.access_instructions ?? '',
    isDefault: location.is_default,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export async function listOwnServiceLocations(
  client: MobileSupabaseClient,
): Promise<readonly ServiceLocation[]> {
  const { data, error } = await client
    .from('service_locations')
    .select(
      'id, label, address_line, building, floor, unit, access_instructions, latitude, longitude, is_default, created_at, updated_at',
    )
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getOwnServiceLocation(
  client: MobileSupabaseClient,
  locationId: string,
): Promise<ServiceLocation | null> {
  const { data, error } = await client
    .from('service_locations')
    .select(
      'id, label, address_line, building, floor, unit, access_instructions, latitude, longitude, is_default, created_at, updated_at',
    )
    .eq('id', locationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveOwnServiceLocation(
  client: MobileSupabaseClient,
  draft: ServiceLocationDraft,
  locationId?: string,
  coordinatesChanged = !locationId,
): Promise<ServiceLocation> {
  const validation = validateServiceLocationDraft(draft);
  if (Object.keys(validation.errors).length > 0) {
    throw new Error('invalid_service_location');
  }
  const value = validation.value;
  const { data, error } = await client.rpc('save_service_location', {
    p_label: value.label,
    p_address_line: value.addressLine,
    p_building: value.building || undefined,
    p_floor: value.floor || undefined,
    p_unit: value.unit || undefined,
    p_access_instructions: value.accessInstructions || undefined,
    p_is_default: value.isDefault,
    p_location_id: locationId,
  });
  if (error) throw error;
  if (
    coordinatesChanged &&
    value.latitude !== null &&
    value.longitude !== null
  ) {
    const { data: located, error: coordinateError } = await client.rpc(
      'update_service_location_coordinates',
      {
        p_location_id: data.id,
        p_latitude: value.latitude,
        p_longitude: value.longitude,
      },
    );
    if (coordinateError) throw coordinateError;
    return located;
  }
  return data;
}

export async function setOwnDefaultServiceLocation(
  client: MobileSupabaseClient,
  locationId: string,
): Promise<ServiceLocation> {
  const { data, error } = await client.rpc('set_default_service_location', {
    p_location_id: locationId,
  });
  if (error) throw error;
  return data;
}

export async function deleteOwnServiceLocation(
  client: MobileSupabaseClient,
  locationId: string,
): Promise<void> {
  const { error } = await client.rpc('delete_service_location', {
    p_location_id: locationId,
  });
  if (error) throw error;
}
