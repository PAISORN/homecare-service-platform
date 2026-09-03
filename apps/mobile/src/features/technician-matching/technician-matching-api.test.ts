import { describe, expect, it } from 'vitest';

import { getMatchingPriceLabel } from './technician-matching-api';

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
