import type { MobileSupabaseClient } from '../../lib/supabase';
import type { JobNotificationRoute } from './notification-route';

export type PushNotificationState =
  | 'checking'
  | 'permission_required'
  | 'enabled'
  | 'disabled'
  | 'permission_denied'
  | 'development_build_required'
  | 'configuration_required'
  | 'unsupported'
  | 'error';

export type PushSynchronizationOptions = Readonly<{
  requestPermission: boolean;
}>;

export type NotificationResponseCleanup = () => void;
export type NotificationRouteHandler = (route: JobNotificationRoute) => void;

export type PushNotificationRuntime = Readonly<{
  synchronizePushDevice: (
    client: MobileSupabaseClient,
    options: PushSynchronizationOptions,
  ) => Promise<PushNotificationState>;
  disableCurrentPushDevice: (
    client: MobileSupabaseClient,
  ) => Promise<PushNotificationState>;
  unregisterCurrentPushDevice: (client: MobileSupabaseClient) => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  installNotificationResponseObserver: (
    handler: NotificationRouteHandler,
  ) => NotificationResponseCleanup;
}>;
