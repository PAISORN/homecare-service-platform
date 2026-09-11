import type { Tables } from '@homecare/database-types';

import type { MobileSupabaseClient } from '../../lib/supabase';

export type NotificationInboxItem = Pick<
  Tables<'notifications'>,
  | 'id'
  | 'event_key'
  | 'title'
  | 'body'
  | 'deep_link'
  | 'read_at'
  | 'created_at'
  | 'service_job_id'
  | 'service_quality_case_id'
>;

const inboxColumns =
  'id, event_key, title, body, deep_link, read_at, created_at, service_job_id, service_quality_case_id';

export async function listNotificationInbox(client: MobileSupabaseClient) {
  const { data, error } = await client
    .from('notifications')
    .select(inboxColumns)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as readonly NotificationInboxItem[];
}

export async function getUnreadNotificationCount(client: MobileSupabaseClient) {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(
  client: MobileSupabaseClient,
  notificationId: string,
) {
  const { data, error } = await client.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(client: MobileSupabaseClient) {
  const { data, error } = await client.rpc('mark_all_notifications_read');
  if (error) throw error;
  return data;
}
