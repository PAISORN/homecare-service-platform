import { describe, expect, it } from 'vitest';

import { colors, spacing } from './index';

describe('design tokens', () => {
  it('มี semantic tokens ที่จำเป็นต่อหน้าจอเริ่มต้น', () => {
    expect(colors.action).toMatch(/^#[0-9A-F]{6}$/i);
    expect(spacing.lg).toBe(16);
  });
});
