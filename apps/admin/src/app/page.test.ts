import { isSupportedServiceCategory } from '@homecare/domain';
import { describe, expect, it } from 'vitest';

import { loadAdminDashboardScaffold } from '../data/admin-dashboard-scaffold';
import { adminDashboardCopyTh } from '../locales/th';

describe('admin shell', () => {
  it('ใช้สถานะ scaffold ที่ไม่ผูกกับตัวเลขหรือพื้นที่', async () => {
    const model = await loadAdminDashboardScaffold();

    expect(
      model.readinessItems.some((item) =>
        /\d|จังหวัด|เขต|พื้นที่/.test(`${item.value}${item.status}`),
      ),
    ).toBe(false);
  });

  it('มีข้อความภาษาไทยสำหรับทุกสถานะที่ query boundary ส่งให้ UI', async () => {
    const model = await loadAdminDashboardScaffold();

    for (const item of model.readinessItems) {
      expect(adminDashboardCopyTh.readinessLabels[item.id]).toBeTruthy();
      expect(adminDashboardCopyTh.readinessValues[item.value]).toBeTruthy();
      expect(adminDashboardCopyTh.readinessStatuses[item.status]).toBeTruthy();
    }
    expect(adminDashboardCopyTh.reviewQueue[model.reviewQueueStatus]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
      }),
    );
  });

  it('domain ยอมรับเฉพาะรหัสหมวด canonical ที่ตรงกับฐานข้อมูล', () => {
    expect(isSupportedServiceCategory('AIR-CONDITIONING')).toBe(true);
    expect(isSupportedServiceCategory('AIR')).toBe(false);
  });
});
