import { describe, expect, it, vi } from 'vitest';

import {
  confirmServiceJobAcceptance,
  formatAcceptanceRemainingTh,
  getServiceJobAcceptance,
  requestServiceJobAcceptanceHelp,
  validateAcceptanceHelpReason,
} from './service-job-acceptance-api';

const acceptance = {
  service_job_id: 'job-1',
  status: 'pending',
  review_deadline_at: '2026-09-13T10:00:00.000Z',
};

describe('service job acceptance API', () => {
  it('formats the durable acceptance deadline without going negative', () => {
    const now = new Date('2026-09-11T10:00:00.000Z');
    expect(formatAcceptanceRemainingTh('2026-09-13T10:00:00.000Z', now)).toBe(
      'เหลือ 2 วัน 0 ชั่วโมง',
    );
    expect(formatAcceptanceRemainingTh('2026-09-11T10:30:00.000Z', now)).toBe(
      'เหลือ 30 นาที',
    );
    expect(formatAcceptanceRemainingTh('2026-09-11T09:00:00.000Z', now)).toBe(
      'ครบกำหนดแล้ว กำลังอัปเดตสถานะ',
    );
  });

  it('validates and trims a meaningful help reason', () => {
    expect(validateAcceptanceHelpReason('  งานยังมีน้ำรั่วที่จุดเดิม  ')).toBe(
      'งานยังมีน้ำรั่วที่จุดเดิม',
    );
    expect(validateAcceptanceHelpReason('สั้น')).toBeNull();
    expect(validateAcceptanceHelpReason('ก'.repeat(1001))).toBeNull();
  });

  it('reads the first acceptance row and supports an absent window', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [acceptance], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const client = { rpc } as never;
    await expect(
      getServiceJobAcceptance(client, 'job-1'),
    ).resolves.toMatchObject(acceptance);
    await expect(getServiceJobAcceptance(client, 'job-2')).resolves.toBeNull();
  });

  it('confirms acceptance through the guarded RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...acceptance, status: 'customer_accepted' },
      error: null,
    });
    await expect(
      confirmServiceJobAcceptance({ rpc } as never, 'job-1'),
    ).resolves.toMatchObject({ status: 'customer_accepted' });
    expect(rpc).toHaveBeenCalledWith('confirm_service_job_acceptance', {
      p_job_id: 'job-1',
    });
  });

  it('rejects invalid help text before calling the backend', async () => {
    const rpc = vi.fn();
    await expect(
      requestServiceJobAcceptanceHelp({ rpc } as never, 'job-1', 'สั้น'),
    ).rejects.toThrow('acceptance_help_reason_invalid');
    expect(rpc).not.toHaveBeenCalled();
  });
});
