import { describe, expect, it } from 'vitest';

import {
  isOperationalControlKey,
  operationalControlCopy,
} from './operational-control-copy';

describe('operational control copy', () => {
  it('defines a safe explanation for every pilot control', () => {
    expect(Object.keys(operationalControlCopy).sort()).toEqual([
      'content',
      'matching',
      'payment',
    ]);
  });

  it('rejects unknown control keys at the action boundary', () => {
    expect(isOperationalControlKey('matching')).toBe(true);
    expect(isOperationalControlKey('unknown')).toBe(false);
  });
});
