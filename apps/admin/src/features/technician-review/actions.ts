'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireTechnicianReviewer } from '@/features/auth/auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

import {
  parseReviewActionInput,
  parseReviewTargetId,
} from './review-validation';

export type ReviewActionState = Readonly<{
  status: 'idle' | 'success' | 'error';
  message: string;
}>;

function actionError(error: unknown): ReviewActionState {
  const message = error instanceof Error ? error.message : '';
  if (message === 'reason_required') {
    return { status: 'error', message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' };
  }
  return {
    status: 'error',
    message: 'ดำเนินการไม่สำเร็จ ข้อมูลอาจมีการเปลี่ยนแปลง กรุณาลองใหม่',
  };
}

export async function reviewDocumentAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    await requireTechnicianReviewer();
    const technicianId = parseReviewTargetId(formData.get('technicianId'));
    const input = parseReviewActionInput(formData);
    const client = await createAdminSupabaseClient();
    const { error } = await client.rpc('review_technician_document', {
      p_document_id: input.targetId,
      p_decision: input.decision,
      p_reason: input.reason ?? undefined,
    });
    if (error) throw new Error('review_rpc_failed');
    revalidatePath('/technicians');
    revalidatePath(`/technicians/${technicianId}`);
    return { status: 'success', message: 'บันทึกผลตรวจเอกสารแล้ว' };
  } catch (error) {
    return actionError(error);
  }
}

export async function decideApplicationAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  let technicianId: string;
  try {
    await requireTechnicianReviewer();
    const input = parseReviewActionInput(formData);
    technicianId = input.targetId;
    const client = await createAdminSupabaseClient();
    const { error } = await client.rpc('decide_technician_profile', {
      p_technician_id: input.targetId,
      p_decision: input.decision === 'approved' ? 'verified' : 'rejected',
      p_reason: input.reason ?? undefined,
    });
    if (error) throw new Error('review_rpc_failed');
    revalidatePath('/technicians');
    revalidatePath(`/technicians/${technicianId}`);
  } catch (error) {
    return actionError(error);
  }

  redirect('/technicians');
}
