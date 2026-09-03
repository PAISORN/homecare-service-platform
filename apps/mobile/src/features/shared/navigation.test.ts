import { describe, expect, it, vi } from 'vitest';

import { goBackOrReplace } from './navigation';

describe('goBackOrReplace', () => {
  it('preserves the existing navigation history when one is available', () => {
    const router = {
      back: vi.fn(),
      canGoBack: () => true,
      replace: vi.fn(),
    };

    goBackOrReplace(router, '/account');

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('uses a deterministic fallback for a cold deep link', () => {
    const router = {
      back: vi.fn(),
      canGoBack: () => false,
      replace: vi.fn(),
    };

    goBackOrReplace(router, '/account');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/account');
  });
});
