import { describe, expect, it, vi } from 'vitest';

import {
  getUnreadNotificationCount,
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-inbox-api';

describe('notification inbox API', () => {
  it('loads the latest recipient notifications without push tokens', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'notice-1' }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });

    await expect(listNotificationInbox({ from } as never)).resolves.toEqual([
      { id: 'notice-1' },
    ]);
    expect(from).toHaveBeenCalledWith('notifications');
    expect(select).toHaveBeenCalledWith(
      expect.not.stringContaining('expo_push_token'),
    );
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(100);
  });

  it('counts only unread notifications', async () => {
    const is = vi.fn().mockResolvedValue({ count: 4, error: null });
    const select = vi.fn().mockReturnValue({ is });
    const from = vi.fn().mockReturnValue({ select });

    await expect(getUnreadNotificationCount({ from } as never)).resolves.toBe(
      4,
    );
    expect(select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(is).toHaveBeenCalledWith('read_at', null);
  });

  it('marks one or all notifications through guarded RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await markNotificationRead({ rpc } as never, 'notice-1');
    await markAllNotificationsRead({ rpc } as never);

    expect(rpc).toHaveBeenNthCalledWith(1, 'mark_notification_read', {
      p_notification_id: 'notice-1',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'mark_all_notifications_read');
  });
});
