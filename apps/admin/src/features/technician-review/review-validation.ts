export type ReviewActionInput = Readonly<{
  targetId: string;
  decision: 'approved' | 'rejected';
  reason: string | null;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseReviewTargetId(value: FormDataEntryValue | null) {
  const targetId = String(value ?? '').trim();
  if (!UUID_PATTERN.test(targetId)) throw new Error('invalid_target');
  return targetId;
}

export function parseReviewActionInput(formData: FormData): ReviewActionInput {
  const targetId = parseReviewTargetId(formData.get('targetId'));
  const decision = String(formData.get('decision') ?? '');
  const rawReason = String(formData.get('reason') ?? '').trim();

  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('invalid_decision');
  }
  if (decision === 'rejected' && !rawReason) {
    throw new Error('reason_required');
  }

  return {
    targetId,
    decision,
    reason: decision === 'rejected' ? rawReason : null,
  };
}

export function canApproveTechnicianApplication(
  documents: readonly { type: string; status: string }[],
) {
  const requiredTypes = ['national_id', 'selfie'] as const;
  return requiredTypes.every(
    (type) =>
      documents.filter(
        (document) => document.type === type && document.status === 'approved',
      ).length === 1,
  );
}
