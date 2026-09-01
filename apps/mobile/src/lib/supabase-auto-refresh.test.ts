import { describe, expect, it, vi } from 'vitest';

import { synchronizeSupabaseAutoRefresh } from './supabase-auto-refresh';

describe('synchronizeSupabaseAutoRefresh', () => {
  it('starts auth refresh immediately while the app is active', () => {
    const startAutoRefresh = vi.fn();
    const stopAutoRefresh = vi.fn();

    synchronizeSupabaseAutoRefresh(
      { startAutoRefresh, stopAutoRefresh },
      'active',
    );

    expect(startAutoRefresh).toHaveBeenCalledOnce();
    expect(stopAutoRefresh).not.toHaveBeenCalled();
  });

  it.each(['background', 'inactive', 'unknown', null, undefined])(
    'stops auth refresh for non-active state %s',
    (state) => {
      const startAutoRefresh = vi.fn();
      const stopAutoRefresh = vi.fn();

      synchronizeSupabaseAutoRefresh(
        { startAutoRefresh, stopAutoRefresh },
        state,
      );

      expect(stopAutoRefresh).toHaveBeenCalledOnce();
      expect(startAutoRefresh).not.toHaveBeenCalled();
    },
  );
});
