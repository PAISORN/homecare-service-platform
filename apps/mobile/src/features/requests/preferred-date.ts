const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parsePreferredDate(value: string): Date | null {
  if (!isoDatePattern.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toPreferredDateValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPreferredDateTh(
  value: string,
  format: 'long' | 'short' = 'long',
): string | null {
  const date = parsePreferredDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDraftScheduleTh(
  preferredDate: string | null,
  preferredTimeWindow: string | null,
): string | null {
  const date = preferredDate
    ? formatPreferredDateTh(preferredDate, 'short')
    : null;
  const time = preferredTimeWindow?.trim() || null;
  if (date && time) return `วันที่สะดวก ${date} · ${time}`;
  if (date) return `วันที่สะดวก ${date}`;
  if (time) return `ช่วงเวลาที่สะดวก ${time}`;
  return null;
}
