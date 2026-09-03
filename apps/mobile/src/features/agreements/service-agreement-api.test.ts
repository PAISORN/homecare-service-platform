import { describe, expect, it } from 'vitest';

import {
  formatServiceAddress,
  validateAppointmentProposal,
} from './service-agreement-api';

describe('appointment proposal validation', () => {
  it('trims a complete future proposal', () => {
    const result = validateAppointmentProposal(
      ' 2026-09-06 ',
      ' 09:00–12:00 ',
      new Date(2026, 8, 4),
    );
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      appointmentDate: '2026-09-06',
      appointmentTimeWindow: '09:00–12:00',
    });
  });

  it('rejects an incomplete or past proposal', () => {
    expect(
      validateAppointmentProposal('2026-09-03', '', new Date(2026, 8, 4))
        .errors,
    ).toEqual({
      appointmentDate: 'invalid',
      appointmentTimeWindow: 'required',
    });
  });
});

describe('service address formatting', () => {
  it('keeps optional building details on a separate readable line', () => {
    expect(
      formatServiceAddress({
        address_line: '99/99 ถนนทดสอบ กรุงเทพมหานคร 10110',
        building: 'HomeCare Test Residence',
        floor: '5',
        unit: '502',
      }),
    ).toBe(
      '99/99 ถนนทดสอบ กรุงเทพมหานคร 10110\nHomeCare Test Residence · ชั้น 5 · ห้อง/ยูนิต 502',
    );
  });
});
