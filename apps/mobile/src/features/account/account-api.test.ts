import { describe, expect, it } from 'vitest';

import { canUseTechnicianMode } from './account-api';

describe('canUseTechnicianMode', () => {
  it('unlocks technician mode only after verification', () => {
    expect(canUseTechnicianMode(null)).toBe(false);
    expect(
      canUseTechnicianMode({
        user_id: 'test-user',
        bio: null,
        kyc_notice_version: null,
        kyc_notice_acknowledged_at: null,
        verification_status: 'draft',
        rejection_reason: null,
      }),
    ).toBe(false);
    expect(
      canUseTechnicianMode({
        user_id: 'test-user',
        bio: null,
        kyc_notice_version: '2026-08-31-v1',
        kyc_notice_acknowledged_at: '2026-08-31T00:00:00Z',
        verification_status: 'pending_review',
        rejection_reason: null,
      }),
    ).toBe(false);
    expect(
      canUseTechnicianMode({
        user_id: 'test-user',
        bio: null,
        kyc_notice_version: '2026-08-31-v1',
        kyc_notice_acknowledged_at: '2026-08-31T00:00:00Z',
        verification_status: 'verified',
        rejection_reason: null,
      }),
    ).toBe(true);
  });
});
