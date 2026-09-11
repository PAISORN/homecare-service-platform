import { describe, expect, it } from 'vitest';

import { qualityCasePath } from './routes';

describe('service quality routes', () => {
  it('creates a concrete App Router path instead of a dynamic href object', () => {
    expect(qualityCasePath('498386e1-bcc2-4521-aed4-3796256f8fb8')).toBe(
      '/cases/498386e1-bcc2-4521-aed4-3796256f8fb8',
    );
  });
});
