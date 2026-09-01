'use client';

import { useActionState } from 'react';

import type { ReviewActionState } from './actions';

const initialReviewActionState: ReviewActionState = {
  status: 'idle',
  message: '',
};

type ReviewAction = (
  state: ReviewActionState,
  formData: FormData,
) => Promise<ReviewActionState>;

export function ReviewActionForm({
  action,
  targetId,
  technicianId,
  kind,
}: Readonly<{
  action: ReviewAction;
  targetId: string;
  technicianId?: string;
  kind: 'document' | 'application';
}>) {
  const [approveState, approveAction, approvePending] = useActionState(
    action,
    initialReviewActionState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    action,
    initialReviewActionState,
  );
  const noun = kind === 'document' ? 'เอกสาร' : 'ใบสมัคร';

  return (
    <div className="decision-panel">
      <form action={approveAction} className="approve-form">
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="technicianId" value={technicianId} />
        <input type="hidden" name="decision" value="approved" />
        <p className="decision-help">
          ยืนยันว่า{noun}ถูกต้องและข้อมูลสอดคล้องกันแล้ว
        </p>
        <button type="submit" disabled={approvePending || rejectPending}>
          {approvePending ? 'กำลังบันทึก…' : `อนุมัติ${noun}`}
        </button>
        <ActionFeedback state={approveState} />
      </form>

      <details className="reject-disclosure">
        <summary>ไม่อนุมัติ{noun}</summary>
        <form action={rejectAction} className="form-stack compact-form">
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="technicianId" value={technicianId} />
          <input type="hidden" name="decision" value="rejected" />
          <label htmlFor={`reason-${kind}-${targetId}`}>
            เหตุผลที่ไม่อนุมัติ <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={`reason-${kind}-${targetId}`}
            name="reason"
            rows={3}
            required
            minLength={3}
            aria-describedby={`reason-help-${kind}-${targetId}`}
          />
          <p id={`reason-help-${kind}-${targetId}`} className="field-help">
            ระบุให้ชัดเจนเพื่อใช้เป็นหลักฐานการตรวจสอบและแจ้งช่าง
          </p>
          <button
            type="submit"
            className="danger-button"
            disabled={approvePending || rejectPending}
          >
            {rejectPending ? 'กำลังบันทึก…' : `ยืนยันไม่อนุมัติ${noun}`}
          </button>
          <ActionFeedback state={rejectState} />
        </form>
      </details>
    </div>
  );
}

function ActionFeedback({ state }: Readonly<{ state: ReviewActionState }>) {
  if (state.status === 'idle') return null;
  return (
    <p
      className={state.status === 'error' ? 'form-error' : 'form-success'}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}
