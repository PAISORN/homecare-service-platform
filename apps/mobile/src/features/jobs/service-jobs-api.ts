import type { MobileSupabaseClient } from '../../lib/supabase';
import { requestJobNotificationDispatch } from '../notifications/push-device-api';

export type ServiceJobStatus =
  | 'scheduled'
  | 'technician_en_route'
  | 'technician_arrived'
  | 'in_progress'
  | 'awaiting_additional_work_approval'
  | 'awaiting_acceptance'
  | 'cancelled';

export type ServiceJobActorRole = 'customer' | 'technician';

export type ServiceJobListItem = Readonly<{
  job_id: string;
  service_request_id: string;
  job_number: string;
  actor_role: ServiceJobActorRole;
  category_name_th: string;
  item_name_th: string | null;
  counterpart_display_name: string;
  job_status: ServiceJobStatus;
  appointment_date: string;
  appointment_time_window: string;
  location_label: string;
  total_amount: number;
  currency: string;
  updated_at: string;
}>;

export type ServiceJobDetail = Readonly<{
  job_id: string;
  service_request_id: string;
  job_number: string;
  actor_role: ServiceJobActorRole;
  customer_display_name: string;
  technician_display_name: string;
  category_name_th: string;
  item_name_th: string | null;
  scope_description: string;
  labor_amount: number;
  materials_amount: number;
  total_amount: number;
  currency: string;
  labor_commission_rate: number;
  commission_amount: number;
  technician_net_labor_amount: number;
  warranty_days: number | null;
  job_status: ServiceJobStatus;
  appointment_date: string;
  appointment_time_window: string;
  location_label: string;
  address_line: string;
  building: string | null;
  floor: string | null;
  unit: string | null;
  access_instructions: string | null;
  created_at: string;
  updated_at: string;
}>;

export type ServiceJobStatusEvent = Readonly<{
  event_id: string;
  from_status: ServiceJobStatus | null;
  to_status: ServiceJobStatus;
  actor_display_name: string | null;
  reason: string | null;
  created_at: string;
}>;

export function validateCancellationReason(reason: string): string | null {
  const value = reason.trim();
  return value.length >= 10 && value.length <= 500 ? value : null;
}

export function getNextTechnicianStatus(
  status: ServiceJobStatus,
): ServiceJobStatus | null {
  if (status === 'scheduled') return 'technician_en_route';
  if (status === 'technician_en_route') return 'technician_arrived';
  return null;
}

export function canCancelServiceJob(
  role: ServiceJobActorRole,
  status: ServiceJobStatus,
): boolean {
  return role === 'customer'
    ? status === 'scheduled'
    : status === 'scheduled' || status === 'technician_en_route';
}

export async function listServiceJobs(
  client: MobileSupabaseClient,
): Promise<readonly ServiceJobListItem[]> {
  const { data, error } = await client.rpc('list_service_jobs');
  if (error) throw error;
  return data as readonly ServiceJobListItem[];
}

export async function getServiceJob(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<ServiceJobDetail> {
  const { data, error } = await client.rpc('get_service_job', {
    p_job_id: jobId,
  });
  if (error) throw error;
  const job = data[0] as ServiceJobDetail | undefined;
  if (!job) throw new Error('service_job_not_found');
  return job;
}

export async function listServiceJobStatusEvents(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<readonly ServiceJobStatusEvent[]> {
  const { data, error } = await client.rpc('list_service_job_status_events', {
    p_job_id: jobId,
  });
  if (error) throw error;
  return data as readonly ServiceJobStatusEvent[];
}

export async function transitionServiceJob(
  client: MobileSupabaseClient,
  jobId: string,
  expectedStatus: ServiceJobStatus,
  newStatus: ServiceJobStatus,
  reason?: string,
): Promise<void> {
  const { error } = await client.rpc('transition_service_job', {
    p_job_id: jobId,
    p_expected_status: expectedStatus,
    p_new_status: newStatus,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
  requestJobNotificationDispatch(client);
}
