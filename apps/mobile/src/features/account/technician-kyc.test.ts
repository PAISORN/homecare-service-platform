import { describe, expect, it } from 'vitest';

import {
  createDocumentStoragePath,
  hasRequiredKycDocuments,
  MAX_KYC_IMAGE_BYTES,
  prepareKycImage,
} from './technician-kyc';

const jpeg = '/9j/2Q==';
const png = 'iVBORw0KGgo=';

describe('prepareKycImage', () => {
  it('accepts signatures from supported image types', () => {
    expect(prepareKycImage(jpeg, 'image/jpeg').mimeType).toBe('image/jpeg');
    expect(prepareKycImage(png, null).extension).toBe('png');
  });

  it('rejects unsupported or mismatched content', () => {
    expect(() => prepareKycImage(jpeg, 'application/pdf')).toThrow(
      'unsupported_image_type',
    );
    expect(() => prepareKycImage(jpeg, 'image/png')).toThrow(
      'image_type_mismatch',
    );
    expect(() => prepareKycImage('dGV4dA==', null)).toThrow(
      'unsupported_image_type',
    );
  });

  it('rejects images over the six-megabyte mobile limit before decoding', () => {
    const oversizedBase64 = 'A'.repeat(
      Math.ceil((MAX_KYC_IMAGE_BYTES + 1) / 3) * 4,
    );
    expect(() => prepareKycImage(oversizedBase64, null)).toThrow(
      'image_too_large',
    );
  });
});

describe('KYC document helpers', () => {
  it('creates a private path without an original filename', () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const nonce = '00000000-0000-4000-8000-000000000002';
    expect(createDocumentStoragePath(userId, 'selfie', 'jpg', nonce)).toBe(
      `${userId}/selfie-${nonce}.jpg`,
    );
  });

  it('requires both identity card and selfie rows', () => {
    expect(hasRequiredKycDocuments([{ document_type: 'national_id' }])).toBe(
      false,
    );
    expect(
      hasRequiredKycDocuments([
        { document_type: 'national_id' },
        { document_type: 'selfie' },
      ]),
    ).toBe(true);
  });
});
