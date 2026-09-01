import { describe, expect, it } from 'vitest';

import { createSessionHydrationGuard } from './session-hydration-guard';

describe('session hydration generation guard', () => {
  it('accepts only the latest request for the same current session user', () => {
    const guard = createSessionHydrationGuard();
    const first = guard.begin('user-a');
    const second = guard.begin('user-a');

    expect(guard.isCurrent(first, 'user-a')).toBe(false);
    expect(guard.isCurrent(second, 'user-a')).toBe(true);
  });

  it('invalidates an in-flight request on sign-out', () => {
    const guard = createSessionHydrationGuard();
    const request = guard.begin('user-a');
    guard.invalidate();

    expect(guard.isCurrent(request, null)).toBe(false);
  });

  it('rejects a completed A request after a rapid switch to B', () => {
    const guard = createSessionHydrationGuard();
    const requestA = guard.begin('user-a');
    const requestB = guard.begin('user-b');

    expect(guard.isCurrent(requestA, 'user-b')).toBe(false);
    expect(guard.isCurrent(requestB, 'user-b')).toBe(true);
    expect(guard.isCurrent(requestB, 'user-a')).toBe(false);
  });
});
