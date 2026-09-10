import type { Tables } from '@homecare/database-types';

import {
  prepareKycImage,
  type PreparedKycImage,
} from '../account/technician-kyc';
import type { MobileSupabaseClient } from '../../lib/supabase';

const EVIDENCE_BUCKET = 'service-job-evidence';

export type ServiceJobEvidenceType =
  'before' | 'during' | 'after' | 'additional_work';
export type ServiceJobPinPurpose = 'start' | 'completion';
export type AdditionalWorkStatus = 'pending' | 'approved' | 'rejected';

export type ServiceJobEvidence = Tables<'service_job_evidence'> & {
  signedUrl: string;
};
export type AdditionalWorkRequest =
  Tables<'service_job_additional_work_requests'>;

export function createServiceJobEvidencePath(
  userId: string,
  jobId: string,
  evidenceType: ServiceJobEvidenceType,
  nonce: string,
  extension: PreparedKycImage['extension'],
) {
  for (const value of [userId, jobId, nonce]) {
    if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('invalid_uuid');
  }
  return `${userId}/${jobId}/${evidenceType}/${nonce}.${extension}`;
}

export async function listServiceJobEvidence(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<readonly ServiceJobEvidence[]> {
  const { data, error } = await client
    .from('service_job_evidence')
    .select('*')
    .eq('service_job_id', jobId)
    .order('created_at');
  if (error) throw error;
  return Promise.all(
    data.map(async (evidence) => {
      const { data: signed, error: signedError } = await client.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(evidence.storage_path, 600);
      if (signedError) throw signedError;
      return { ...evidence, signedUrl: signed.signedUrl };
    }),
  );
}

export async function uploadServiceJobEvidence(
  client: MobileSupabaseClient,
  userId: string,
  jobId: string,
  evidenceType: ServiceJobEvidenceType,
  base64: string,
  declaredMimeType: string | null | undefined,
  nonce: string,
): Promise<Tables<'service_job_evidence'>> {
  const prepared = prepareKycImage(base64, declaredMimeType);
  const storagePath = createServiceJobEvidencePath(
    userId,
    jobId,
    evidenceType,
    nonce,
    prepared.extension,
  );
  const { data: reservation, error: registrationError } = await client.rpc(
    'register_service_job_evidence',
    {
      p_job_id: jobId,
      p_evidence_type: evidenceType,
      p_storage_path: storagePath,
      p_mime_type: prepared.mimeType,
      p_size_bytes: prepared.byteLength,
    },
  );
  if (registrationError) throw registrationError;
  const { error: uploadError } = await client.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, prepared.body, {
      contentType: prepared.mimeType,
      upsert: false,
    });
  if (!uploadError) return reservation;
  await client.rpc('delete_unuploaded_service_job_evidence', {
    p_evidence_id: reservation.id,
  });
  throw uploadError;
}

export async function issueServiceJobPin(
  client: MobileSupabaseClient,
  jobId: string,
  purpose: ServiceJobPinPurpose,
): Promise<string> {
  const { data, error } = await client.rpc('issue_service_job_pin', {
    p_job_id: jobId,
    p_purpose: purpose,
  });
  if (error) throw error;
  return data;
}

export async function verifyServiceJobPin(
  client: MobileSupabaseClient,
  jobId: string,
  purpose: ServiceJobPinPurpose,
  pin: string,
): Promise<Readonly<{ verified: boolean; attempts_remaining?: number }>> {
  const { data, error } = await client.rpc('verify_service_job_pin', {
    p_job_id: jobId,
    p_purpose: purpose,
    p_pin: pin,
  });
  if (error) throw error;
  return data as { verified: boolean; attempts_remaining?: number };
}

export async function listAdditionalWorkRequests(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<readonly AdditionalWorkRequest[]> {
  const { data, error } = await client
    .from('service_job_additional_work_requests')
    .select('*')
    .eq('service_job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAdditionalWorkRequest(
  client: MobileSupabaseClient,
  input: Readonly<{
    jobId: string;
    evidenceId: string;
    scopeDescription: string;
    reason: string;
    laborAmount: number;
    materialsAmount: number;
  }>,
) {
  const { data, error } = await client.rpc(
    'create_service_job_additional_work_request',
    {
      p_job_id: input.jobId,
      p_evidence_id: input.evidenceId,
      p_scope_description: input.scopeDescription,
      p_reason: input.reason,
      p_labor_amount: input.laborAmount,
      p_materials_amount: input.materialsAmount,
    },
  );
  if (error) throw error;
  return data;
}

export async function respondToAdditionalWork(
  client: MobileSupabaseClient,
  requestId: string,
  approve: boolean,
) {
  const { data, error } = await client.rpc(
    'respond_to_service_job_additional_work',
    { p_request_id: requestId, p_approve: approve },
  );
  if (error) throw error;
  return data;
}
