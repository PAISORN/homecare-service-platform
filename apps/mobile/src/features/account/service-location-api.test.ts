import { describe, expect, it } from 'vitest';

import {
  emptyServiceLocationDraft,
  serviceLocationToDraft,
  validateServiceLocationDraft,
} from './service-location-api';

describe('service-location validation', () => {
  it('requires a label and address', () => {
    const result = validateServiceLocationDraft(emptyServiceLocationDraft);

    expect(result.errors).toEqual({
      label: 'required',
      addressLine: 'required',
    });
  });

  it('trims values and accepts blank optional details', () => {
    const result = validateServiceLocationDraft({
      label: '  บ้าน  ',
      addressLine: '  99 ถนนสุขุมวิท  ',
      building: ' ',
      floor: '',
      unit: '',
      accessInstructions: '  โทรก่อนถึง  ',
      isDefault: true,
    });

    expect(result.errors).toEqual({});
    expect(result.value).toMatchObject({
      label: 'บ้าน',
      addressLine: '99 ถนนสุขุมวิท',
      building: '',
      accessInstructions: 'โทรก่อนถึง',
      isDefault: true,
    });
  });

  it('enforces the database length contract before sending a request', () => {
    const result = validateServiceLocationDraft({
      label: 'ก'.repeat(81),
      addressLine: 'ข'.repeat(501),
      building: 'ค'.repeat(161),
      floor: 'ง'.repeat(41),
      unit: 'จ'.repeat(41),
      accessInstructions: 'ฉ'.repeat(501),
      isDefault: false,
    });

    expect(result.errors).toEqual({
      label: 'too_long',
      addressLine: 'too_long',
      building: 'too_long',
      floor: 'too_long',
      unit: 'too_long',
      accessInstructions: 'too_long',
    });
  });

  it('maps nullable database fields into editable form values', () => {
    expect(
      serviceLocationToDraft({
        id: 'location-id',
        label: 'บ้าน',
        address_line: 'กรุงเทพฯ',
        building: null,
        floor: null,
        unit: null,
        access_instructions: null,
        is_default: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }),
    ).toEqual({
      label: 'บ้าน',
      addressLine: 'กรุงเทพฯ',
      building: '',
      floor: '',
      unit: '',
      accessInstructions: '',
      isDefault: true,
    });
  });
});
