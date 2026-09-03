import type { Enums, Tables } from '@homecare/database-types';

import type { MobileSupabaseClient } from '../../lib/supabase';

export type TechnicianMatchingRequest = Readonly<{
  request_id: string;
  category_name_th: string;
  item_name_th: string | null;
  quantity: number;
  urgency: Enums<'request_urgency'>;
  preferred_date: string | null;
  preferred_time_window: string | null;
  price_model: Enums<'price_model'> | null;
  submitted_at: string;
  interest_status: Enums<'technician_interest_status'> | null;
}>;

export type TechnicianSkillCategory = Pick<
  Tables<'service_categories'>,
  'id' | 'name_th' | 'sort_order'
> & { selected: boolean };

export async function listTechnicianMatchingRequests(
  client: MobileSupabaseClient,
): Promise<readonly TechnicianMatchingRequest[]> {
  const { data, error } = await client.rpc('list_matching_service_requests');
  if (error) throw error;
  return data;
}

export async function expressTechnicianInterest(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<void> {
  const { error } = await client.rpc('express_technician_interest', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function withdrawTechnicianInterest(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<void> {
  const { error } = await client.rpc('withdraw_technician_interest', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function listTechnicianSkillCategories(
  client: MobileSupabaseClient,
  technicianId: string,
): Promise<readonly TechnicianSkillCategory[]> {
  const [categoriesResult, skillsResult] = await Promise.all([
    client
      .from('service_categories')
      .select('id, name_th, sort_order')
      .in('status', ['pilot', 'active'])
      .order('sort_order'),
    client
      .from('technician_skills')
      .select('service_category_id')
      .eq('technician_id', technicianId)
      .eq('is_active', true),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (skillsResult.error) throw skillsResult.error;
  const selectedIds = new Set(
    skillsResult.data.map(({ service_category_id }) => service_category_id),
  );
  return categoriesResult.data.map((category) => ({
    ...category,
    selected: selectedIds.has(category.id),
  }));
}

export async function setTechnicianSkillCategory(
  client: MobileSupabaseClient,
  technicianId: string,
  serviceCategoryId: string,
  selected: boolean,
): Promise<void> {
  const { error } = selected
    ? await client.from('technician_skills').upsert(
        {
          technician_id: technicianId,
          service_category_id: serviceCategoryId,
          is_active: true,
        },
        { onConflict: 'technician_id,service_category_id' },
      )
    : await client
        .from('technician_skills')
        .update({ is_active: false })
        .eq('technician_id', technicianId)
        .eq('service_category_id', serviceCategoryId);
  if (error) throw error;
}

export function getMatchingPriceLabel(
  priceModel: Enums<'price_model'> | null,
): string {
  if (priceModel === 'fixed') return 'ราคามาตรฐานตามรายการ';
  if (priceModel === 'onsite_inspection') return 'ตรวจหน้างานก่อนเสนอราคา';
  return 'ประเมินและเสนอราคาจากข้อมูลที่ได้รับ';
}
