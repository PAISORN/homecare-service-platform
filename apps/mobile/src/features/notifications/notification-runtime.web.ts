import type { PushNotificationRuntime } from './notification-runtime-types';

export const pushNotificationRuntime: PushNotificationRuntime = {
  synchronizePushDevice: async () => 'unsupported',
  disableCurrentPushDevice: async () => 'unsupported',
  unregisterCurrentPushDevice: async () => undefined,
  openNotificationSettings: async () => undefined,
  installNotificationResponseObserver: () => () => undefined,
};
