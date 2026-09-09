import type { MobileSupabaseClient } from '../../lib/supabase';
import { parsePreferredDate } from '../requests/preferred-date';

export type ServiceRequestAgreement = Readonly<{
  request_id: string;
  actor_role: 'customer' | 'technician';
  category_name_th: string;
  item_name_th: string | null;
  problem_description: string;
  quantity: number;
  location_label: string;
  address_line: string;
  building: string | null;
  floor: string | null;
  unit: string | null;
  customer_display_name: string;
  technician_display_name: string;
  scope_description: string;
  labor_amount: number;
  currency: string;
  appointment_date: string | null;
  appointment_time_window: string | null;
  revision: number;
  customer_confirmed: boolean;
  technician_confirmed: boolean;
  fully_confirmed_at: string | null;
  updated_at: string;
}>;

export type TechnicianSelectedRequest = Readonly<{
  request_id: string;
  category_name_th: string;
  item_name_th: string | null;
  customer_display_name: string;
  appointment_date: string | null;
  appointment_time_window: string | null;
  customer_confirmed: boolean;
  technician_confirmed: boolean;
  fully_confirmed_at: string | null;
  updated_at: string;
}>;

export type ServiceJobSummary = Readonly<{
  job_id: string;
  job_number: string;
  actor_role: 'customer' | 'technician';
  customer_display_name: string;
  technician_display_name: string;
  scope_description: string;
  labor_amount: number;
  materials_amount: number;
  total_amount: number;
  currency: string;
  labor_commission_rate: number;
  commission_amount: number;
  technician_net_labor_amount: number;
  warranty_days: number | null;
  job_status:
    | 'scheduled'
    | 'technician_en_route'
    | 'technician_arrived'
    | 'in_progress'
    | 'cancelled';
  appointment_date: string;
  appointment_time_window: string;
  location_label: string;
  address_line: string;
  building: string | null;
  floor: string | null;
  unit: string | null;
  created_at: string;
}>;

export type AppointmentProposalValidation = Readonly<{
  value: { appointmentDate: string; appointmentTimeWindow: string };
  errors: Partial<
    Record<'appointmentDate' | 'appointmentTimeWindow', 'required' | 'invalid'>
  >;
}>;

export function validateAppointmentProposal(
  appointmentDate: string,
  appointmentTimeWindow: string,
  today = new Date(),
): AppointmentProposalValidation {
  const value = {
    appointmentDate: appointmentDate.trim(),
    appointmentTimeWindow: appointmentTimeWindow.trim(),
  };
  const errors: AppointmentProposalValidation['errors'] = {};
  const date = parsePreferredDate(value.appointmentDate);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );

  if (!value.appointmentDate) errors.appointmentDate = 'required';
  else if (!date || date < startOfToday) errors.appointmentDate = 'invalid';
  if (!value.appointmentTimeWindow) {
    errors.appointmentTimeWindow = 'required';
  } else if (value.appointmentTimeWindow.length > 80) {
    errors.appointmentTimeWindow = 'invalid';
  }

  return { value, errors };
}

export function formatServiceAddress(
  agreement: Pick<
    ServiceRequestAgreement,
    'address_line' | 'building' | 'floor' | 'unit'
  >,
): string {
  const detail = [
    agreement.building,
    agreement.floor ? `ชั้น ${agreement.floor}` : null,
    agreement.unit ? `ห้อง/ยูนิต ${agreement.unit}` : null,
  ].filter(Boolean);
  return [agreement.address_line, detail.join(' · ')]
    .filter(Boolean)
    .join('\n');
}

export async function getServiceRequestAgreement(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<ServiceRequestAgreement> {
  const { data, error } = await client.rpc('get_service_request_agreement', {
    p_request_id: requestId,
  });
  if (error) throw error;
  const agreement = data[0] as ServiceRequestAgreement | undefined;
  if (!agreement) throw new Error('service_request_agreement_not_found');
  return agreement;
}

export async function listTechnicianSelectedRequests(
  client: MobileSupabaseClient,
): Promise<readonly TechnicianSelectedRequest[]> {
  const { data, error } = await client.rpc('list_technician_selected_requests');
  if (error) throw error;
  return data as readonly TechnicianSelectedRequest[];
}

export async function proposeServiceRequestAppointment(
  client: MobileSupabaseClient,
  requestId: string,
  appointmentDate: string,
  appointmentTimeWindow: string,
): Promise<void> {
  const validation = validateAppointmentProposal(
    appointmentDate,
    appointmentTimeWindow,
  );
  if (Object.keys(validation.errors).length > 0) {
    throw new Error('invalid_appointment_proposal');
  }
  const { error } = await client.rpc('propose_service_request_appointment', {
    p_request_id: requestId,
    p_appointment_date: validation.value.appointmentDate,
    p_appointment_time_window: validation.value.appointmentTimeWindow,
  });
  if (error) throw error;
}

export async function confirmServiceRequestAgreement(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<void> {
  const { error } = await client.rpc('confirm_service_request_agreement', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function getServiceJobForRequest(
  client: MobileSupabaseClient,
  requestId: string,
): Promise<ServiceJobSummary> {
  const { data, error } = await client.rpc('get_service_job_for_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  const job = data[0] as ServiceJobSummary | undefined;
  if (!job) throw new Error('service_job_not_found');
  return job;
}
