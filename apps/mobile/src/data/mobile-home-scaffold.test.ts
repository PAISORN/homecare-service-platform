import { serviceCategoryCodes } from '@homecare/domain/database';
import { describe, expect, it } from 'vitest';

import { mobileHomeCopyTh } from '../locales/th';
import { loadMobileHomeScaffold } from './mobile-home-scaffold';

describe('mobile home query boundary', () => {
  it('returns only canonical database category identifiers', () => {
    const model = loadMobileHomeScaffold();

    expect(model.serviceCategoryCodes).toEqual(serviceCategoryCodes);
    expect(model.serviceCategoryCodes).not.toContain('AIR');
  });

  it('has Thai copy for every category returned by the data source', () => {
    const model = loadMobileHomeScaffold();

    for (const categoryCode of model.serviceCategoryCodes) {
      expect(mobileHomeCopyTh.categoryLabels[categoryCode]).toBeTruthy();
    }
    expect(
      mobileHomeCopyTh.availability[model.availabilityStatus].title,
    ).toBeTruthy();
  });
});
