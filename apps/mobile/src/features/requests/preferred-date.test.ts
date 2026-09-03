import { describe, expect, it } from 'vitest';

import {
  formatDraftScheduleTh,
  formatPreferredDateTh,
  parsePreferredDate,
  toPreferredDateValue,
} from './preferred-date';

describe('preferred date presentation', () => {
  it('round-trips a local ISO date without a timezone shift', () => {
    const parsed = parsePreferredDate('2030-01-02');
    expect(parsed).not.toBeNull();
    expect(toPreferredDateValue(parsed!)).toBe('2030-01-02');
  });

  it('rejects impossible calendar dates', () => {
    expect(parsePreferredDate('2030-02-30')).toBeNull();
    expect(formatPreferredDateTh('not-a-date')).toBeNull();
  });

  it('formats the persisted date in the Thai Buddhist calendar', () => {
    expect(formatPreferredDateTh('2030-01-02')).toContain('2573');
  });

  it('builds draft schedule summaries without empty separators', () => {
    expect(formatDraftScheduleTh('2030-01-02', '09:00–12:00')).toContain(
      '09:00–12:00',
    );
    expect(formatDraftScheduleTh(null, ' ช่วงบ่าย ')).toBe(
      'ช่วงเวลาที่สะดวก ช่วงบ่าย',
    );
    expect(formatDraftScheduleTh(null, null)).toBeNull();
  });
});
