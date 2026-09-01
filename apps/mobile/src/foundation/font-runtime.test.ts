import { describe, expect, it } from 'vitest';

import { fontFamiliesFor, resolveFontStartupState } from './font-runtime';

describe('mobile font startup', () => {
  it('keeps the splash visible only while fonts are still pending', () => {
    expect(resolveFontStartupState(false, undefined)).toBe('loading');
  });

  it('uses the branded Thai font families after a successful load', () => {
    expect(resolveFontStartupState(true, undefined)).toBe('ready');
    expect(fontFamiliesFor('ready')).toEqual({
      regular: 'NotoSansThai_400Regular',
      semiBold: 'NotoSansThai_600SemiBold',
      bold: 'NotoSansThai_700Bold',
    });
  });

  it('renders with platform fonts when font loading fails', () => {
    expect(resolveFontStartupState(false, new Error('font failed'))).toBe(
      'fallback',
    );
    expect(fontFamiliesFor('fallback')).toEqual({
      regular: undefined,
      semiBold: undefined,
      bold: undefined,
    });
  });
});
