import { describe, expect, it } from 'vitest';

import { isSupportedServiceCategory } from './database';

describe('isSupportedServiceCategory', () => {
  it('ยอมรับเฉพาะสามหมวดนำร่อง', () => {
    expect(isSupportedServiceCategory('AIR-CONDITIONING')).toBe(true);
    expect(isSupportedServiceCategory('air_conditioning')).toBe(false);
    expect(isSupportedServiceCategory('general_repair')).toBe(false);
  });
});
