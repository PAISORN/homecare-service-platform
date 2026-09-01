import { describe, expect, it } from 'vitest';

import {
  canApproveTechnicianApplication,
  parseReviewActionInput,
} from './review-validation';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

describe('technician review validation', () => {
  it('strips approval reasons so the canonical RPC contract stays unambiguous', () => {
    expect(
      parseReviewActionInput(
        form({ targetId: TARGET_ID, decision: 'approved', reason: 'ignored' }),
      ),
    ).toEqual({ targetId: TARGET_ID, decision: 'approved', reason: null });
  });

  it('requires a trimmed reason for rejection', () => {
    expect(() =>
      parseReviewActionInput(
        form({ targetId: TARGET_ID, decision: 'rejected', reason: '   ' }),
      ),
    ).toThrow('reason_required');
  });

  it('only allows final approval after both required documents are approved once', () => {
    expect(
      canApproveTechnicianApplication([
        { type: 'national_id', status: 'approved' },
        { type: 'selfie', status: 'approved' },
      ]),
    ).toBe(true);
    expect(
      canApproveTechnicianApplication([
        { type: 'national_id', status: 'approved' },
        { type: 'selfie', status: 'pending' },
      ]),
    ).toBe(false);
  });
});
