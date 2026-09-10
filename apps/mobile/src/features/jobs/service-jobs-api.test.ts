import { describe, expect, it } from 'vitest';

import {
  canCancelServiceJob,
  getNextTechnicianStatus,
  validateCancellationReason,
} from './service-jobs-api';

describe('service job workflow helpers', () => {
  it('trims and accepts a meaningful cancellation reason', () => {
    expect(validateCancellationReason('  ไม่สะดวกตามเวลานัดหมายแล้ว  ')).toBe(
      'ไม่สะดวกตามเวลานัดหมายแล้ว',
    );
  });

  it('rejects cancellation reasons outside 10 to 500 characters', () => {
    expect(validateCancellationReason('สั้น')).toBeNull();
    expect(validateCancellationReason('ก'.repeat(501))).toBeNull();
  });

  it('uses the guarded technician progression order', () => {
    expect(getNextTechnicianStatus('scheduled')).toBe('technician_en_route');
    expect(getNextTechnicianStatus('technician_en_route')).toBe(
      'technician_arrived',
    );
    expect(getNextTechnicianStatus('technician_arrived')).toBeNull();
    expect(getNextTechnicianStatus('in_progress')).toBeNull();
    expect(getNextTechnicianStatus('awaiting_acceptance')).toBeNull();
    expect(getNextTechnicianStatus('completed')).toBeNull();
    expect(getNextTechnicianStatus('cancelled')).toBeNull();
  });

  it('allows cancellation only before the actor-specific cutoff', () => {
    expect(canCancelServiceJob('customer', 'scheduled')).toBe(true);
    expect(canCancelServiceJob('customer', 'technician_en_route')).toBe(false);
    expect(canCancelServiceJob('technician', 'technician_en_route')).toBe(true);
    expect(canCancelServiceJob('technician', 'technician_arrived')).toBe(false);
  });
});
