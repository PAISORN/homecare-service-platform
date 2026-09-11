import type { Tables } from '@homecare/database-types';

import { prepareKycImage } from '../account/technician-kyc';
import type { MobileSupabaseClient } from '../../lib/supabase';

const QUALITY_BUCKET = 'service-quality-evidence';

export type ServiceQualityCase = Tables<'service_quality_cases'>;
export type ServiceJobWarranty = Tables<'service_job_warranties'>;
export type ServiceJobReview = Tables<'service_job_reviews'>;
export type ServiceQualityAttachment =
  Tables<'service_quality_case_attachments'> & {
    signedUrl: string;
  };
export type ServiceQualityCaseKind = 'warranty_claim' | 'complaint';
export type ServiceQualityCategory =
  'work_quality' | 'behavior' | 'price_scope' | 'safety' | 'other';

export function validateQualityDetails(value: string) {
  const details = value.trim();
  return details.length >= 20 && details.length <= 2000 ? details : null;
}

export async function getServiceQualitySummary(
  client: MobileSupabaseClient,
  jobId: string,
) {
  const [warranty, cases, review] = await Promise.all([
    client
      .from('service_job_warranties')
      .select('*')
      .eq('service_job_id', jobId)
      .maybeSingle(),
    client
      .from('service_quality_cases')
      .select('*')
      .eq('service_job_id', jobId)
      .order('created_at', { ascending: false }),
    client
      .from('service_job_reviews')
      .select('*')
      .eq('service_job_id', jobId)
      .maybeSingle(),
  ]);
  if (warranty.error) throw warranty.error;
  if (cases.error) throw cases.error;
  if (review.error) throw review.error;
  return {
    warranty: warranty.data,
    cases: cases.data,
    review: review.data,
  };
}

export async function openServiceQualityCase(
  client: MobileSupabaseClient,
  input: Readonly<{
    jobId: string;
    kind: ServiceQualityCaseKind;
    category: ServiceQualityCategory;
    details: string;
  }>,
) {
  const { data, error } = await client.rpc('open_service_quality_case', {
    p_job_id: input.jobId,
    p_kind: input.kind,
    p_category: input.category,
    p_details: input.details,
  });
  if (error) throw error;
  return data;
}

export async function respondToServiceQualityCase(
  client: MobileSupabaseClient,
  caseId: string,
  response: string,
) {
  const { data, error } = await client.rpc('respond_to_service_quality_case', {
    p_case_id: caseId,
    p_response: response.trim(),
  });
  if (error) throw error;
  return data;
}

export async function submitServiceJobReview(
  client: MobileSupabaseClient,
  input: Readonly<{
    jobId: string;
    overall: number;
    quality: number;
    punctuality: number;
    priceClarity: number;
    manners: number;
    tags: readonly string[];
    text?: string;
  }>,
) {
  const { data, error } = await client.rpc('submit_service_job_review', {
    p_job_id: input.jobId,
    p_overall: input.overall,
    p_quality: input.quality,
    p_punctuality: input.punctuality,
    p_price_clarity: input.priceClarity,
    p_manners: input.manners,
    p_tags: [...input.tags],
    p_review_text: input.text?.trim() || undefined,
  });
  if (error) throw error;
  return data;
}

export async function respondToServiceJobReview(
  client: MobileSupabaseClient,
  reviewId: string,
  response: string,
) {
  const { data, error } = await client.rpc('respond_to_service_job_review', {
    p_review_id: reviewId,
    p_response: response.trim(),
  });
  if (error) throw error;
  return data;
}

export async function uploadServiceQualityAttachment(
  client: MobileSupabaseClient,
  input: Readonly<{
    userId: string;
    caseId: string;
    nonce: string;
    base64: string;
    mimeType?: string | null;
  }>,
) {
  const image = prepareKycImage(input.base64, input.mimeType);
  const path = `${input.userId}/${input.caseId}/${input.nonce}.${image.extension}`;
  const { data: row, error: reserveError } = await client.rpc(
    'register_service_quality_case_attachment',
    {
      p_case_id: input.caseId,
      p_storage_path: path,
      p_mime_type: image.mimeType,
      p_size_bytes: image.byteLength,
    },
  );
  if (reserveError) throw reserveError;
  const { error: uploadError } = await client.storage
    .from(QUALITY_BUCKET)
    .upload(path, image.body, { contentType: image.mimeType, upsert: false });
  if (uploadError) {
    await client.rpc('delete_unuploaded_service_quality_case_attachment', {
      p_attachment_id: row.id,
    });
    throw uploadError;
  }
  return row;
}
