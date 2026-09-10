import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatTravelDistanceTh,
  formatTravelEtaTh,
  formatTravelFreshnessTh,
} from './service-job-travel-api';

describe('service-job travel presentation', () => {
  afterEach(() => vi.useRealTimers());

  it('formats short and long straight-line distances', () => {
    expect(formatTravelDistanceTh(null)).toBeNull();
    expect(formatTravelDistanceTh(0.42)).toBe('ห่างประมาณ 420 เมตร');
    expect(formatTravelDistanceTh(2.34)).toBe('ห่างประมาณ 2.3 กม.');
  });

  it('formats the ETA without claiming route precision', () => {
    expect(formatTravelEtaTh(null)).toBeNull();
    expect(formatTravelEtaTh(1)).toBe('ใกล้ถึงแล้ว');
    expect(formatTravelEtaTh(12)).toBe('คาดว่าจะถึงในประมาณ 12 นาที');
  });

  it('formats durable snapshot freshness', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T15:30:00Z'));
    expect(formatTravelFreshnessTh(null)).toBeNull();
    expect(formatTravelFreshnessTh('2026-09-10T15:29:45Z')).toBe(
      'อัปเดตตำแหน่งเมื่อสักครู่',
    );
    expect(formatTravelFreshnessTh('2026-09-10T15:27:00Z')).toBe(
      'อัปเดตตำแหน่ง 3 นาทีที่แล้ว',
    );
  });
});
