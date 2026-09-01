const thaiLocalPhonePattern = /^0[689]\d{8}$/;
const thaiE164PhonePattern = /^\+66[689]\d{8}$/;

export function normalizeThaiPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, '');

  if (thaiE164PhonePattern.test(compact)) return compact;
  if (thaiLocalPhonePattern.test(compact)) return `+66${compact.slice(1)}`;
  return null;
}

export function normalizeOtp(value: string): string | null {
  const compact = value.replace(/\s/g, '');
  return /^\d{6}$/.test(compact) ? compact : null;
}

export function formatThaiPhoneForDisplay(phone: string): string {
  const e164Phone = phone.startsWith('66') ? `+${phone}` : phone;
  if (!thaiE164PhonePattern.test(e164Phone)) return phone;
  const local = `0${e164Phone.slice(3)}`;
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}
