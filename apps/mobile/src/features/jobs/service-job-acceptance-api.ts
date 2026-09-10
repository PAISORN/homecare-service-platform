import type { MobileSupabaseClient } from '../../lib/supabase';
import { requestJobNotificationDispatch } from '../notifications/push-device-api';

export type ServiceJobAcceptanceStatus =
  'pending' | 'help_requested' | 'customer_accepted' | 'automatic_accepted';

export type ServiceJobAcceptance = Readonly<{
  service_job_id: string;
  customer_id: string;
  technician_id: string;
  status: ServiceJobAcceptanceStatus;
  review_started_at: string;
  review_deadline_at: string;
  total_amount_snapshot: number;
  currency: string;
  payment_mode: 'fake_sandbox';
  accepted_by: string | null;
  accepted_at: string | null;
  help_requested_at: string | null;
  help_reason: string | null;
  created_at: string;
  updated_at: string;
}>;

export function validateAcceptanceHelpReason(reason: string): string | null {
  const value = reason.trim();
  return value.length >= 10 && value.length <= 1000 ? value : null;
}

export function formatAcceptanceRemainingTh(
  deadline: string,
  now = new Date(),
): string {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(deadline).getTime() - now.getTime()) / 60_000),
  );
  if (remainingMinutes === 0) return 'ครบกำหนดแล้ว กำลังอัปเดตสถานะ';
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  const minutes = remainingMinutes % 60;
  if (days > 0) return `เหลือ ${days} วัน ${hours} ชั่วโมง`;
  if (hours > 0) return `เหลือ ${hours} ชั่วโมง ${minutes} นาที`;
  return `เหลือ ${minutes} นาที`;
}

export async function getServiceJobAcceptance(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<ServiceJobAcceptance | null> {
  const { data, error } = await client.rpc('get_service_job_acceptance', {
    p_job_id: jobId,
  });
  if (error) throw error;
  return (data[0] as ServiceJobAcceptance | undefined) ?? null;
}

export async function confirmServiceJobAcceptance(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<ServiceJobAcceptance> {
  const { data, error } = await client.rpc('confirm_service_job_acceptance', {
    p_job_id: jobId,
  });
  if (error) throw error;
  requestJobNotificationDispatch(client);
  return data as ServiceJobAcceptance;
}

export async function requestServiceJobAcceptanceHelp(
  client: MobileSupabaseClient,
  jobId: string,
  reason: string,
): Promise<ServiceJobAcceptance> {
  const validReason = validateAcceptanceHelpReason(reason);
  if (!validReason) throw new Error('acceptance_help_reason_invalid');
  const { data, error } = await client.rpc(
    'request_service_job_acceptance_help',
    { p_job_id: jobId, p_reason: validReason },
  );
  if (error) throw error;
  return data as ServiceJobAcceptance;
}
