import type { Enums, Tables } from '@homecare/database-types';
import type { MobileSupabaseClient } from '../../lib/supabase';
import {
  prepareKycImage,
  type PreparedKycImage,
} from '../account/technician-kyc';

export type CatalogItem = Pick<
  Tables<'service_items'>,
  | 'id'
  | 'service_category_id'
  | 'code'
  | 'name_th'
  | 'description_th'
  | 'price_model'
  | 'base_labor_price'
  | 'currency'
  | 'status'
>;

export type CatalogCategory = Pick<
  Tables<'service_categories'>,
  'id' | 'code' | 'name_th' | 'description_th' | 'status' | 'sort_order'
> & { service_items: readonly CatalogItem[] };

export type ServiceRequestDraft = Tables<'service_requests'> & {
  service_categories: { name_th: string } | null;
  service_items: { name_th: string } | null;
  service_locations: { label: string } | null;
};

export type CustomerRequestShortlistItem = Readonly<{
  request_id: string;
  request_status: Enums<'service_request_status'>;
  price_model: Enums<'price_model'>;
  catalog_labor_amount: number | null;
  currency: string;
  technician_id: string;
  display_name: string;
  technician_bio: string | null;
  years_experience: number | null;
  interest_created_at: string;
  quotation_id: string | null;
  quotation_scope_description: string | null;
  quotation_labor_amount: number | null;
  quotation_submitted_at: string | null;
  shortlist_rank: number;
  is_selected: boolean;
}>;

export type RequestAttachment = Tables<'request_attachments'> & {
  signedUrl: string;
};

export type RequestSafetyAnswers = Readonly<{
  fireSmoke: boolean;
  waterNearElectricity: boolean;
  externalPowerHazard: boolean;
  uncontrolledWater: boolean;
  outOfScopeAccess: boolean;
}>;

export type ServiceRequestDraftInput = Readonly<{
  requestId?: string;
  serviceLocationId: string;
  serviceCategoryId: string;
  serviceItemId?: string;
  entryPoint: Enums<'request_entry_point'>;
  problemDescription: string;
  quantity: number;
  urgency: Enums<'request_urgency'>;
  preferredDate: string;
  preferredTimeWindow: string;
  safetyAnswers: RequestSafetyAnswers;
}>;

export type ServiceRequestValidation = Readonly<{
  value: ServiceRequestDraftInput;
  errors: Readonly<
    Partial<
      Record<
        | 'serviceLocationId'
        | 'serviceCategoryId'
        | 'serviceItemId'
        | 'problemDescription'
        | 'quantity'
        | 'preferredDate'
        | 'preferredTimeWindow',
        'required' | 'invalid' | 'too_long'
      >
    >
  >;
}>;

export const emptySafetyAnswers: RequestSafetyAnswers = {
  fireSmoke: false,
  waterNearElectricity: false,
  externalPowerHazard: false,
  uncontrolledWater: false,
  outOfScopeAccess: false,
};

export function validateServiceRequestDraft(
  input: ServiceRequestDraftInput,
  today = new Date(),
): ServiceRequestValidation {
  const value = {
    ...input,
    problemDescription: input.problemDescription.trim(),
    preferredDate: input.preferredDate.trim(),
    preferredTimeWindow: input.preferredTimeWindow.trim(),
  };
  const errors: ServiceRequestValidation['errors'] extends Readonly<infer T>
    ? T
    : never = {};

  if (!value.serviceLocationId) errors.serviceLocationId = 'required';
  if (!value.serviceCategoryId) errors.serviceCategoryId = 'required';
  if (value.entryPoint === 'service_catalog' && !value.serviceItemId) {
    errors.serviceItemId = 'required';
  }
  if (!value.problemDescription) errors.problemDescription = 'required';
  else if (value.problemDescription.length > 2000) {
    errors.problemDescription = 'too_long';
  }
  if (
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > 50
  ) {
    errors.quantity = 'invalid';
  }
  if (value.preferredTimeWindow.length > 80) {
    errors.preferredTimeWindow = 'too_long';
  }
  if (value.preferredDate) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const candidate = new Date(`${value.preferredDate}T00:00:00`);
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const [year, month, day] = value.preferredDate.split('-').map(Number);
    if (
      !datePattern.test(value.preferredDate) ||
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== year ||
      candidate.getMonth() + 1 !== month ||
      candidate.getDate() !== day ||
      candidate < startOfToday
    ) {
      errors.preferredDate = 'invalid';
    }
  }

  return { value, errors };
}

export function getSafetyStopCode(
  answers: RequestSafetyAnswers,
):
  | 'FIRE_SMOKE'
  | 'WATER_NEAR_ELECTRICITY'
  | 'EXTERNAL_POWER_HAZARD'
  | 'UNCONTROLLED_WATER'
  | 'OUT_OF_SCOPE_ACCESS'
  | null {
  if (answers.fireSmoke) return 'FIRE_SMOKE';
  if (answers.waterNearElectricity) return 'WATER_NEAR_ELECTRICITY';
  if (answers.externalPowerHazard) return 'EXTERNAL_POWER_HAZARD';
  if (answers.uncontrolledWater) return 'UNCONTROLLED_WATER';
  if (answers.outOfScopeAccess) return 'OUT_OF_SCOPE_ACCESS';
  return null;
}

export function formatCatalogPrice(item: CatalogItem): string {
  if (item.price_model === 'evidence_quote')
    return 'ประเมินจากรายละเอียดและรูป';
  if (item.price_model === 'onsite_inspection')
    return 'ตรวจหน้างานก่อนเสนอราคา';
  if (item.base_labor_price === null) return 'ราคามาตรฐานกำลังรอยืนยัน';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: item.currency,
    maximumFractionDigits: 0,
  }).format(item.base_labor_price);
}

export async function listPilotCatalog(
  client: MobileSupabaseClient,
): Promise<readonly CatalogCategory[]> {
  const { data, error } = await client
    .from('service_categories')
    .select(
      'id, code, name_th, description_th, status, sort_order, service_items(id, service_category_id, code, name_th, description_th, price_model, base_labor_price, currency, status)',
    )
    .in('status', ['pilot', 'active'])
    .in('service_items.status', ['pilot', 'active'])
    .order('sort_order')
    .order('code', { referencedTable: 'service_items' });
  if (error) throw error;
  return data;
}

const requestDraftSelect =
  '*, service_categories(name_th), service_items(name_th), service_locations(label)' as const;

export async function listOwnServiceRequests(
  client: MobileSupabaseClient,
): Promise<readonly ServiceRequestDraft[]> {
  const { data, error } = await client
    .from('service_requests')
    .select(requestDraftSelect)
    .in('status', ['draft', 'matching', 'technician_selected'])
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listCustomerRequestShortlist(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<readonly CustomerRequestShortlistItem[]> {
  const { data, error } = await client.rpc('list_customer_request_shortlist', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function selectTechnicianForRequest(
  client: MobileSupabaseClient,
  requestId: string,
  technicianId: string,
): Promise<void> {
  const { error } = await client.rpc('select_technician_for_request', {
    p_request_id: requestId,
    p_technician_id: technicianId,
  });
  if (error) throw error;
}

export function getShortlistPrice(
  item: CustomerRequestShortlistItem,
): Readonly<{ amount: number | null; currency: string; ready: boolean }> {
  if (item.price_model === 'evidence_quote') {
    return {
      amount: item.quotation_labor_amount,
      currency: item.currency,
      ready: item.quotation_id !== null && item.quotation_labor_amount !== null,
    };
  }
  return {
    amount: item.catalog_labor_amount,
    currency: item.currency,
    ready: item.catalog_labor_amount !== null,
  };
}

export function formatLaborAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function submitOwnServiceRequest(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<Tables<'service_requests'>> {
  const { data, error } = await client.rpc('submit_service_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function cancelOwnMatchingRequest(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<Tables<'service_requests'>> {
  const { data, error } = await client.rpc('cancel_service_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function getOwnRequestDraft(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<ServiceRequestDraft | null> {
  const { data, error } = await client
    .from('service_requests')
    .select(requestDraftSelect)
    .eq('id', requestId)
    .eq('status', 'draft')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOwnRequestAttachments(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<readonly RequestAttachment[]> {
  const { data, error } = await client
    .from('request_attachments')
    .select('*')
    .eq('service_request_id', requestId)
    .order('created_at');
  if (error) throw error;
  return Promise.all(
    data.map(async (attachment) => {
      const { data: signed, error: signedError } = await client.storage
        .from('request-attachments')
        .createSignedUrl(attachment.storage_path, 600);
      if (signedError) throw signedError;
      return { ...attachment, signedUrl: signed.signedUrl };
    }),
  );
}

export async function saveOwnRequestDraft(
  client: MobileSupabaseClient,
  input: ServiceRequestDraftInput,
): Promise<Tables<'service_requests'>> {
  const validation = validateServiceRequestDraft(input);
  if (Object.keys(validation.errors).length > 0) {
    throw new Error('invalid_service_request');
  }
  const value = validation.value;
  const { data, error } = await client.rpc('save_service_request_draft', {
    p_entry_point: value.entryPoint,
    p_intake_answers: {},
    p_preferred_date: (value.preferredDate || null) as unknown as string,
    p_preferred_time_window: (value.preferredTimeWindow ||
      null) as unknown as string,
    p_problem_description: value.problemDescription,
    p_quantity: value.quantity,
    p_request_id: value.requestId,
    p_safety_answers: {
      fire_smoke: value.safetyAnswers.fireSmoke,
      water_near_electricity: value.safetyAnswers.waterNearElectricity,
      external_power_hazard: value.safetyAnswers.externalPowerHazard,
      uncontrolled_water: value.safetyAnswers.uncontrolledWater,
      out_of_scope_access: value.safetyAnswers.outOfScopeAccess,
    },
    p_service_category_id: value.serviceCategoryId,
    p_service_item_id: (value.serviceItemId || null) as unknown as string,
    p_service_location_id: value.serviceLocationId,
    p_urgency: value.urgency,
  });
  if (error) throw error;
  return data;
}

export async function uploadRequestImage(
  client: MobileSupabaseClient,
  userId: string,
  requestId: string,
  base64: string,
  declaredMimeType?: string | null,
  nonce?: string,
): Promise<Tables<'request_attachments'>> {
  const prepared = prepareKycImage(base64, declaredMimeType);
  if (!nonce) throw new Error('missing_nonce');
  const storagePath = createRequestAttachmentPath(
    userId,
    requestId,
    nonce,
    prepared.extension,
  );
  const { data: reservation, error: registrationError } = await client.rpc(
    'register_request_attachment',
    {
      p_mime_type: prepared.mimeType,
      p_service_request_id: requestId,
      p_size_bytes: prepared.byteLength,
      p_storage_path: storagePath,
    },
  );
  if (registrationError) throw registrationError;

  const { error: uploadError } = await client.storage
    .from('request-attachments')
    .upload(storagePath, prepared.body, {
      contentType: prepared.mimeType,
      upsert: false,
    });
  if (!uploadError) return reservation;

  await client.rpc('delete_request_attachment', {
    p_attachment_id: reservation.id,
  });
  throw uploadError;
}

export async function deleteOwnRequestAttachment(
  client: MobileSupabaseClient,
  attachment: Tables<'request_attachments'>,
): Promise<void> {
  const { error: storageError } = await client.storage
    .from('request-attachments')
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error } = await client.rpc('delete_request_attachment', {
    p_attachment_id: attachment.id,
  });
  if (error) throw error;
}

export function createRequestAttachmentPath(
  userId: string,
  requestId: string,
  nonce: string,
  extension: PreparedKycImage['extension'],
): string {
  for (const value of [userId, requestId, nonce]) {
    if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('invalid_uuid');
  }
  return `${userId}/${requestId}/${nonce}.${extension}`;
}
