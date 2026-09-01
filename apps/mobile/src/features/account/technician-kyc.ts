import type { Enums } from '@homecare/database-types';

export const MAX_KYC_IMAGE_BYTES = 6 * 1024 * 1024;
export const KYC_NOTICE_VERSION = '2026-08-31-v1';

export type RequiredTechnicianDocumentType = Extract<
  Enums<'technician_document_type'>,
  'national_id' | 'selfie'
>;

export type SupportedKycMime = 'image/jpeg' | 'image/png';

export type PreparedKycImage = Readonly<{
  body: ArrayBuffer;
  mimeType: SupportedKycMime;
  extension: 'jpg' | 'png';
  byteLength: number;
}>;

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function prepareKycImage(
  base64Input: string,
  declaredMimeType?: string | null,
): PreparedKycImage {
  const base64 = base64Input.replace(/\s/g, '');
  if (
    !base64 ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new Error('invalid_image_data');
  }

  if (
    declaredMimeType &&
    declaredMimeType !== 'image/jpeg' &&
    declaredMimeType !== 'image/png'
  ) {
    throw new Error('unsupported_image_type');
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = (base64.length / 4) * 3 - padding;
  if (byteLength > MAX_KYC_IMAGE_BYTES) throw new Error('image_too_large');

  const bytes = decodeBase64(base64, byteLength);
  const detectedMimeType = detectImageMime(bytes);
  if (!detectedMimeType) throw new Error('unsupported_image_type');
  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    throw new Error('image_type_mismatch');
  }

  return {
    body: bytes.buffer as ArrayBuffer,
    mimeType: detectedMimeType,
    extension: detectedMimeType === 'image/jpeg' ? 'jpg' : 'png',
    byteLength,
  };
}

export function createDocumentStoragePath(
  userId: string,
  documentType: RequiredTechnicianDocumentType,
  extension: PreparedKycImage['extension'],
  nonce: string,
): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('invalid_user_id');
  if (!/^[0-9a-f-]{36}$/i.test(nonce)) throw new Error('invalid_nonce');
  return `${userId}/${documentType}-${nonce}.${extension}`;
}

export function hasRequiredKycDocuments(
  documents: readonly { document_type: string }[],
): boolean {
  return (
    documents.some(({ document_type }) => document_type === 'national_id') &&
    documents.some(({ document_type }) => document_type === 'selfie')
  );
}

function decodeBase64(base64: string, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let writeIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(base64[index] ?? '');
    const second = BASE64_ALPHABET.indexOf(base64[index + 1] ?? '');
    const thirdCharacter = base64[index + 2] ?? '=';
    const fourthCharacter = base64[index + 3] ?? '=';
    const third =
      thirdCharacter === '=' ? 0 : BASE64_ALPHABET.indexOf(thirdCharacter);
    const fourth =
      fourthCharacter === '=' ? 0 : BASE64_ALPHABET.indexOf(fourthCharacter);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      throw new Error('invalid_image_data');
    }

    if (writeIndex < byteLength)
      bytes[writeIndex++] = (first << 2) | (second >> 4);
    if (writeIndex < byteLength)
      bytes[writeIndex++] = ((second & 15) << 4) | (third >> 2);
    if (writeIndex < byteLength)
      bytes[writeIndex++] = ((third & 3) << 6) | fourth;
  }

  return bytes;
}

function detectImageMime(bytes: Uint8Array): SupportedKycMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}
