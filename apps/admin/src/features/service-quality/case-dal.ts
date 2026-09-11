import 'server-only';

import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function listQualityCases() {
  const client = await createAdminSupabaseClient();
  const { data, error } = await client
    .from('service_quality_cases')
    .select(
      'id, service_job_id, kind, category, status, details, payment_hold_simulated, created_at, updated_at',
    )
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPendingReviews() {
  const client = await createAdminSupabaseClient();
  const { data, error } = await client
    .from('service_job_reviews')
    .select('id, service_job_id, overall_rating, review_text, tags, created_at')
    .eq('status', 'pending_moderation')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function getQualityCase(caseId: string) {
  const client = await createAdminSupabaseClient();
  const [caseResult, eventsResult, attachmentsResult] = await Promise.all([
    client
      .from('service_quality_cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle(),
    client
      .from('service_quality_case_events')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at'),
    client
      .from('service_quality_case_attachments')
      .select('id, storage_path, mime_type, size_bytes, created_at')
      .eq('case_id', caseId)
      .order('created_at'),
  ]);
  if (caseResult.error) throw caseResult.error;
  if (!caseResult.data) return null;
  if (eventsResult.error) throw eventsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;
  const attachments = await Promise.all(
    (attachmentsResult.data ?? []).map(async (attachment) => {
      const { data, error } = await client.storage
        .from('service-quality-evidence')
        .createSignedUrl(attachment.storage_path, 600);
      if (error) throw error;
      return { ...attachment, signedUrl: data.signedUrl };
    }),
  );
  return {
    qualityCase: caseResult.data,
    events: eventsResult.data ?? [],
    attachments,
  };
}
