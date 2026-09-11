import { describe, expect, it } from 'vitest';

import { getAdminLandingPath } from './admin-landing-path';

describe('admin landing path', () => {
  it('sends a technician reviewer to the review queue', () => {
    expect(getAdminLandingPath(['technician_review', 'case_management'])).toBe(
      '/technicians',
    );
  });

  it('sends a case-only manager to the quality queue', () => {
    expect(getAdminLandingPath(['case_management'])).toBe('/cases');
  });

  it('rejects an administrator without an operational permission', () => {
    expect(getAdminLandingPath([])).toBe('/unauthorized');
  });
});
