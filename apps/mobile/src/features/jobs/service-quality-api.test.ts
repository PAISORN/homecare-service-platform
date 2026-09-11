import { describe, expect, it, vi } from 'vitest';

import {
  openServiceQualityCase,
  respondToServiceJobReview,
  submitServiceJobReview,
  validateQualityDetails,
} from './service-quality-api';

describe('service quality API', () => {
  it('validates and trims meaningful case details', () => {
    expect(
      validateQualityDetails('  แอร์ยังมีกลิ่นอับหลังล้างเสร็จแล้ว  '),
    ).toBe('แอร์ยังมีกลิ่นอับหลังล้างเสร็จแล้ว');
    expect(validateQualityDetails('รายละเอียดสั้น')).toBeNull();
    expect(validateQualityDetails('ก'.repeat(2001))).toBeNull();
  });

  it('opens a complaint through the guarded RPC', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { id: 'case-1' }, error: null });
    await openServiceQualityCase({ rpc } as never, {
      jobId: 'job-1',
      kind: 'complaint',
      category: 'work_quality',
      details: 'แอร์ยังมีกลิ่นอับหลังล้างเสร็จแล้ว',
    });
    expect(rpc).toHaveBeenCalledWith('open_service_quality_case', {
      p_job_id: 'job-1',
      p_kind: 'complaint',
      p_category: 'work_quality',
      p_details: 'แอร์ยังมีกลิ่นอับหลังล้างเสร็จแล้ว',
    });
  });

  it('submits all review dimensions for moderation', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { id: 'review-1' }, error: null });
    await submitServiceJobReview({ rpc } as never, {
      jobId: 'job-1',
      overall: 4,
      quality: 4,
      punctuality: 5,
      priceClarity: 4,
      manners: 5,
      tags: ['ตรงเวลา'],
      text: 'ช่างสุภาพและตรงเวลา',
    });
    expect(rpc).toHaveBeenCalledWith(
      'submit_service_job_review',
      expect.objectContaining({
        p_job_id: 'job-1',
        p_overall: 4,
        p_quality: 4,
        p_punctuality: 5,
        p_price_clarity: 4,
        p_manners: 5,
      }),
    );
  });

  it('returns backend errors to the screen', async () => {
    const failure = new Error('already_responded');
    const rpc = vi.fn().mockResolvedValue({ data: null, error: failure });
    await expect(
      respondToServiceJobReview(
        { rpc } as never,
        'review-1',
        'ขอบคุณสำหรับความคิดเห็น',
      ),
    ).rejects.toBe(failure);
  });
});
