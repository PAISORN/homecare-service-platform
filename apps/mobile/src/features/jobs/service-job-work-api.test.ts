import { describe, expect, it } from 'vitest';

import { createServiceJobEvidencePath } from './service-job-work-api';

describe('service job work helpers', () => {
  it('creates an immutable evidence path scoped to technician and job', () => {
    expect(
      createServiceJobEvidencePath(
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        'before',
        '30000000-0000-0000-0000-000000000003',
        'jpg',
      ),
    ).toBe(
      '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002/before/30000000-0000-0000-0000-000000000003.jpg',
    );
  });

  it('rejects malformed identifiers before upload', () => {
    expect(() =>
      createServiceJobEvidencePath(
        'bad',
        '20000000-0000-0000-0000-000000000002',
        'after',
        '30000000-0000-0000-0000-000000000003',
        'png',
      ),
    ).toThrow('invalid_uuid');
  });
});
