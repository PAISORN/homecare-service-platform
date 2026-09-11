import { describe, expect, it } from 'vitest';

import {
  formatQualityDeadline,
  qualityEventLabels,
  qualityNextActorLabels,
  qualitySlaLabels,
} from './service-quality-copy';

describe('service quality SLA copy', () => {
  it('uses explicit Thai labels instead of color-only SLA meaning', () => {
    expect(qualitySlaLabels.overdue).toBe('เกินกำหนด');
    expect(qualityNextActorLabels.technician).toBe('รอช่าง');
    expect(qualityEventLabels.sla_due_soon).toContain('SLA');
  });

  it('formats closed cases without a fake deadline', () => {
    expect(formatQualityDeadline(null)).toBe('ไม่มีกำหนดเวลา');
  });
});
