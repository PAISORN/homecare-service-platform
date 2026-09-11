'use server';

import { revalidatePath } from 'next/cache';

import { requireCaseManager } from '@/features/auth/auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const openStatuses = new Set([
  'under_review',
  'awaiting_customer',
  'awaiting_technician',
]);
const closedStatuses = new Set(['resolved', 'dismissed']);
const decisions = new Set([
  'no_action',
  'warranty_rework',
  'assign_other_technician',
  'partial_refund_simulated',
  'full_refund_simulated',
  'other',
]);

export async function updateQualityCaseAction(formData: FormData) {
  await requireCaseManager();
  const caseId = String(formData.get('caseId') ?? '');
  const status = String(formData.get('status') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const amountText = String(formData.get('amount') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) throw new Error('invalid_case');
  if (!openStatuses.has(status) && !closedStatuses.has(status))
    throw new Error('invalid_status');
  if (
    closedStatuses.has(status) &&
    (!decisions.has(decision) || note.length < 10 || note.length > 2000)
  )
    throw new Error('invalid_decision');
  const amount = amountText ? Number(amountText) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0))
    throw new Error('invalid_amount');
  const client = await createAdminSupabaseClient();
  const { error } = await client.rpc('admin_update_service_quality_case', {
    p_case_id: caseId,
    p_status: status as
      | 'under_review'
      | 'awaiting_customer'
      | 'awaiting_technician'
      | 'resolved'
      | 'dismissed',
    p_decision: closedStatuses.has(status)
      ? (decision as 'no_action')
      : undefined,
    p_decision_note: closedStatuses.has(status) ? note : undefined,
    p_simulated_refund_amount: amount ?? undefined,
  });
  if (error) throw error;
  await client.functions.invoke('dispatch-job-notifications');
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}

export async function escalateQualityCaseAction(formData: FormData) {
  await requireCaseManager();
  const caseId = String(formData.get('caseId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) throw new Error('invalid_case');
  const client = await createAdminSupabaseClient();
  const { error } = await client.rpc('admin_escalate_service_quality_case', {
    p_case_id: caseId,
  });
  if (error) throw error;
  await client.functions.invoke('dispatch-job-notifications');
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}

export async function moderateReviewAction(formData: FormData) {
  await requireCaseManager();
  const reviewId = String(formData.get('reviewId') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) throw new Error('invalid_review');
  if (
    !['published', 'hidden'].includes(status) ||
    note.length < 10 ||
    note.length > 1000
  ) {
    throw new Error('invalid_moderation');
  }
  const client = await createAdminSupabaseClient();
  const { error } = await client.rpc('admin_moderate_service_job_review', {
    p_review_id: reviewId,
    p_status: status as 'published' | 'hidden',
    p_note: note,
  });
  if (error) throw error;
  revalidatePath('/cases');
}
