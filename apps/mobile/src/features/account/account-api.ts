import type { Tables } from '@homecare/database-types';

import type { MobileSupabaseClient } from '../../lib/supabase';

export type AccountProfile = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'phone' | 'account_status'
>;

export type TechnicianApplication = Pick<
  Tables<'technician_profiles'>,
  | 'user_id'
  | 'bio'
  | 'verification_status'
  | 'rejection_reason'
  | 'kyc_notice_version'
  | 'kyc_notice_acknowledged_at'
>;

export function canUseTechnicianMode(
  application: TechnicianApplication | null,
): boolean {
  return application?.verification_status === 'verified';
}

export async function updateOwnDisplayName(
  client: MobileSupabaseClient,
  userId: string,
  displayNameInput: string,
): Promise<AccountProfile> {
  const displayName = displayNameInput.trim();
  if (displayName.length < 1 || displayName.length > 120) {
    throw new Error('invalid_display_name');
  }

  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('id, display_name, phone, account_status')
    .single();

  if (error) throw error;
  return data;
}

export async function bootstrapTechnicianApplication(
  client: MobileSupabaseClient,
): Promise<TechnicianApplication> {
  const { data, error } = await client.rpc('bootstrap_technician_application');
  if (error) throw error;

  return {
    user_id: data.user_id,
    bio: data.bio,
    verification_status: data.verification_status,
    rejection_reason: data.rejection_reason,
    kyc_notice_version: data.kyc_notice_version,
    kyc_notice_acknowledged_at: data.kyc_notice_acknowledged_at,
  };
}
