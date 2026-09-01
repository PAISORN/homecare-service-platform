import { describe, expect, it } from 'vitest';

import {
  formatThaiPhoneForDisplay,
  normalizeOtp,
  normalizeThaiPhone,
} from './phone';

describe('normalizeThaiPhone', () => {
  it.each([
    ['0812345678', '+66812345678'],
    ['081-234-5678', '+66812345678'],
    ['(081) 234 5678', '+66812345678'],
    ['+66812345678', '+66812345678'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(normalizeThaiPhone(input)).toBe(expected);
  });

  it.each(['', '021234567', '081234567', '+661234', 'not-a-phone'])(
    'rejects %s',
    (input) => {
      expect(normalizeThaiPhone(input)).toBeNull();
    },
  );
});

describe('OTP and display formatting', () => {
  it('accepts exactly six digits', () => {
    expect(normalizeOtp('12 34 56')).toBe('123456');
    expect(normalizeOtp('12345')).toBeNull();
    expect(normalizeOtp('12345x')).toBeNull();
  });

  it('formats a Thai E.164 mobile number for display', () => {
    expect(formatThaiPhoneForDisplay('+66812345678')).toBe('081-234-5678');
  });

  it('formats the canonical phone returned by Supabase Auth', () => {
    expect(formatThaiPhoneForDisplay('66812345678')).toBe('081-234-5678');
  });
});
