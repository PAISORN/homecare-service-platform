import { describe, expect, it } from 'vitest';

import {
  createRequestAttachmentPath,
  emptySafetyAnswers,
  formatCatalogPrice,
  formatLaborAmount,
  getShortlistPrice,
  getSafetyStopCode,
  validateServiceRequestDraft,
  type CatalogItem,
} from './service-request-api';

const baseInput = {
  serviceLocationId: 'location-id',
  serviceCategoryId: 'category-id',
  serviceItemId: 'item-id',
  entryPoint: 'service_catalog' as const,
  problemDescription: '  แอร์มีฝุ่นและมีกลิ่นอับ  ',
  quantity: 1,
  urgency: 'flexible' as const,
  preferredDate: '2030-01-02',
  preferredTimeWindow: '  ช่วงเช้า  ',
  safetyAnswers: emptySafetyAnswers,
};

describe('service request draft validation', () => {
  it('trims free text and accepts a valid future draft', () => {
    const result = validateServiceRequestDraft(baseInput, new Date(2029, 0, 1));
    expect(result.errors).toEqual({});
    expect(result.value.problemDescription).toBe('แอร์มีฝุ่นและมีกลิ่นอับ');
    expect(result.value.preferredTimeWindow).toBe('ช่วงเช้า');
  });

  it('requires a catalog item only for the catalog entry point', () => {
    const catalog = validateServiceRequestDraft(
      { ...baseInput, serviceItemId: undefined },
      new Date(2029, 0, 1),
    );
    const symptom = validateServiceRequestDraft(
      { ...baseInput, entryPoint: 'symptom', serviceItemId: undefined },
      new Date(2029, 0, 1),
    );
    expect(catalog.errors.serviceItemId).toBe('required');
    expect(symptom.errors.serviceItemId).toBeUndefined();
  });

  it('rejects past or malformed dates and invalid quantities', () => {
    const result = validateServiceRequestDraft(
      { ...baseInput, preferredDate: '2028-02-30', quantity: 0 },
      new Date(2029, 0, 1),
    );
    expect(result.errors.preferredDate).toBe('invalid');
    expect(result.errors.quantity).toBe('invalid');
  });
});

describe('service request safety and pricing presentation', () => {
  it('uses the same safety-stop precedence as the database contract', () => {
    expect(
      getSafetyStopCode({
        ...emptySafetyAnswers,
        fireSmoke: true,
        uncontrolledWater: true,
      }),
    ).toBe('FIRE_SMOKE');
    expect(getSafetyStopCode(emptySafetyAnswers)).toBeNull();
  });

  it('does not invent a fixed price before approval', () => {
    const item = {
      price_model: 'fixed',
      base_labor_price: null,
      currency: 'THB',
    } as CatalogItem;
    expect(formatCatalogPrice(item)).toBe('ราคามาตรฐานกำลังรอยืนยัน');
  });

  it('describes quote and inspection models without fake prices', () => {
    expect(
      formatCatalogPrice({ price_model: 'evidence_quote' } as CatalogItem),
    ).toBe('ประเมินจากรายละเอียดและรูป');
    expect(
      formatCatalogPrice({ price_model: 'onsite_inspection' } as CatalogItem),
    ).toBe('ตรวจหน้างานก่อนเสนอราคา');
  });
});

describe('customer shortlist pricing', () => {
  it('uses the sealed quotation for evidence-priced work', () => {
    expect(
      getShortlistPrice({
        price_model: 'evidence_quote',
        quotation_id: 'quotation-id',
        quotation_labor_amount: 750,
        currency: 'THB',
      } as never),
    ).toEqual({ amount: 750, currency: 'THB', ready: true });
  });

  it('does not enable selection when an approved amount is absent', () => {
    expect(
      getShortlistPrice({
        price_model: 'fixed',
        catalog_labor_amount: null,
        currency: 'THB',
      } as never),
    ).toEqual({ amount: null, currency: 'THB', ready: false });
  });

  it('formats the agreed labor amount in the supplied currency', () => {
    expect(formatLaborAmount(650, 'THB')).toContain('650');
  });
});

describe('request attachment paths', () => {
  it('binds every image to the customer and request prefixes', () => {
    expect(
      createRequestAttachmentPath(
        '80000000-0000-0000-0000-000000000101',
        '81000000-0000-0000-0000-000000000101',
        '82000000-0000-0000-0000-000000000101',
        'jpg',
      ),
    ).toBe(
      '80000000-0000-0000-0000-000000000101/81000000-0000-0000-0000-000000000101/82000000-0000-0000-0000-000000000101.jpg',
    );
  });
});
