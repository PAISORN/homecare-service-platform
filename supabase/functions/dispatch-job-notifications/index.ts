import { withSupabase } from 'npm:@supabase/server@^1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

type JobNotification = Readonly<{
  id: string;
  recipient_user_id: string;
  title: string;
  body: string;
  deep_link: string;
  data: Record<string, unknown>;
  attempt_count: number;
}>;

type ExpoPushTicket = Readonly<{
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Readonly<{ error?: string }>;
}>;

const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';

export default {
  fetch: withSupabase({ auth: 'user' }, async (_request, context) => {
    const actorId = String(context.userClaims?.sub ?? '');
    const isServiceRole = context.userClaims?.role === 'service_role';
    if (!actorId && !isServiceRole) {
      return Response.json({ error: 'authenticated_actor_required' }, { status: 401 });
    }

    const { data: claimed, error: claimError } = await context.supabaseAdmin.rpc(
      isServiceRole
        ? 'claim_pending_notifications'
        : 'claim_job_notifications_for_actor',
      isServiceRole ? { p_limit: 100 } : { p_actor_id: actorId, p_limit: 25 },
    );
    if (claimError) {
      console.error('notification_claim_failed', claimError.code);
      return Response.json({ error: 'notification_claim_failed' }, { status: 500 });
    }

    const notifications = (claimed ?? []) as JobNotification[];
    let submitted = 0;
    let deferred = 0;
    let skipped = 0;

    for (const notification of notifications) {
      const result = await dispatchNotification(context.supabaseAdmin, notification);
      if (result === 'submitted') submitted += 1;
      else if (result === 'skipped') skipped += 1;
      else deferred += 1;
    }

    return Response.json({ processed: notifications.length, submitted, deferred, skipped });
  }),
};

async function dispatchNotification(
  admin: SupabaseClient,
  notification: JobNotification,
): Promise<'submitted' | 'deferred' | 'skipped'> {
  const { data: devices, error: devicesError } = await admin
    .from('push_devices')
    .select('id, expo_push_token')
    .eq('user_id', notification.recipient_user_id)
    .eq('enabled', true)
    .limit(100);

  if (devicesError) {
    await deferNotification(admin, notification, 'push_device_lookup_failed');
    return 'deferred';
  }
  if (!devices?.length) {
    await admin
      .from('notifications')
      .update({ delivery_status: 'skipped', last_error: 'no_enabled_push_device' })
      .eq('id', notification.id)
      .eq('delivery_status', 'processing');
    return 'skipped';
  }

  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const response = await fetch(expoPushEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(
      devices.map((device) => ({
        to: device.expo_push_token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: { ...notification.data, url: notification.deep_link },
      })),
    ),
  }).catch(() => null);

  if (!response) {
    await deferNotification(admin, notification, 'expo_push_unreachable');
    return 'deferred';
  }

  const providerResponse = await response.json().catch(() => null);
  if (!response.ok || !providerResponse) {
    await deferNotification(
      admin,
      notification,
      `expo_push_http_${response.status}`,
      providerResponse,
    );
    return 'deferred';
  }

  const rawTickets = providerResponse.data;
  const tickets: ExpoPushTicket[] = Array.isArray(rawTickets)
    ? rawTickets
    : [rawTickets];
  const accepted = tickets.some((ticket) => ticket?.status === 'ok');

  await Promise.all(
    tickets.map(async (ticket, index) => {
      if (ticket?.details?.error !== 'DeviceNotRegistered') return;
      const device = devices[index];
      if (!device) return;
      await admin.from('push_devices').update({ enabled: false }).eq('id', device.id);
    }),
  );

  if (!accepted) {
    await deferNotification(
      admin,
      notification,
      'expo_push_rejected',
      providerResponse,
    );
    return 'deferred';
  }

  await admin
    .from('notifications')
    .update({
      delivery_status: 'submitted',
      provider_response: providerResponse,
      submitted_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', notification.id)
    .eq('delivery_status', 'processing');
  return 'submitted';
}

async function deferNotification(
  admin: SupabaseClient,
  notification: JobNotification,
  error: string,
  providerResponse: unknown = null,
) {
  const exhausted = notification.attempt_count >= 3;
  const retryDelayMinutes = Math.max(1, 5 * notification.attempt_count);
  await admin
    .from('notifications')
    .update({
      delivery_status: exhausted ? 'failed' : 'pending',
      next_attempt_at: new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
      provider_response: providerResponse,
      last_error: error,
    })
    .eq('id', notification.id)
    .eq('delivery_status', 'processing');
}
