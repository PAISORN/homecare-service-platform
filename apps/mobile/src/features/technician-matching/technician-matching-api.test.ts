import { describe, expect, it } from 'vitest';

import {
  getMatchingPriceLabel,
  validateTechnicianQuotation,
} from './technician-matching-api';

describe('technician matching price labels', () => {
  it('describes every price model without inventing an amount', () => {
    expect(getMatchingPriceLabel('fixed')).toBe('ราคามาตรฐานตามรายการ');
    expect(getMatchingPriceLabel('onsite_inspection')).toBe(
      'ตรวจหน้างานก่อนเสนอราคา',
    );
    expect(getMatchingPriceLabel('evidence_quote')).toBe(
      'ประเมินและเสนอราคาจากข้อมูลที่ได้รับ',
    );
    expect(getMatchingPriceLabel(null)).toBe(
      'ประเมินและเสนอราคาจากข้อมูลที่ได้รับ',
    );
  });
});

describe('technician quotation validation', () => {
  it('trims a valid scope and parses a formatted amount', () => {
    const result = validateTechnicianQuotation({
      requestId: 'request-id',
      scopeDescription: '  ล้างคอยล์และตรวจระบบระบายน้ำ  ',
      laborAmount: '1,250',
    });
    expect(result.errors).toEqual({});
    expect(result.value.scopeDescription).toBe('ล้างคอยล์และตรวจระบบระบายน้ำ');
    expect(result.value.laborAmount).toBe(1250);
  });

  it('rejects a short scope and non-positive amount', () => {
    const result = validateTechnicianQuotation({
      requestId: 'request-id',
      scopeDescription: 'สั้น',
      laborAmount: '0',
    });
    expect(result.errors).toEqual({
      scopeDescription: 'invalid',
      laborAmount: 'invalid',
    });
  });
});
