import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { MobileSupabaseClient } from '../../lib/supabase';
import { parseJobNotificationRoute } from './notification-route';
import type {
  NotificationRouteHandler,
  PushNotificationRuntime,
  PushNotificationState,
  PushSynchronizationOptions,
} from './notification-runtime-types';
import { disablePushDevice, registerPushDevice } from './push-device-api';

const installationKey = 'homecare.push.installation-id';
const optedOutKey = 'homecare.push.opted-out';
const jobUpdatesChannel = 'service-job-updates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function synchronizePushDevice(
  client: MobileSupabaseClient,
  options: PushSynchronizationOptions,
): Promise<PushNotificationState> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
  if (Constants.appOwnership === 'expo') return 'development_build_required';
  if (
    (await AsyncStorage.getItem(optedOutKey)) === 'true' &&
    !options.requestPermission
  ) {
    return 'disabled';
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (typeof projectId !== 'string' || !projectId) {
    return 'configuration_required';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(jobUpdatesChannel, {
      name: 'อัปเดตงานบริการ',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let permission = existingPermission;
  if (existingPermission.status !== 'granted' && options.requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    return permission.canAskAgain ? 'permission_required' : 'permission_denied';
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const installationId = await getOrCreateInstallationId();
    await registerPushDevice(client, {
      installationId,
      expoPushToken: token.data,
      platform: Platform.OS,
    });
    await AsyncStorage.setItem(optedOutKey, 'false');
    return 'enabled';
  } catch {
    return 'error';
  }
}

async function disableCurrentPushDevice(
  client: MobileSupabaseClient,
): Promise<PushNotificationState> {
  const installationId = await AsyncStorage.getItem(installationKey);
  if (installationId) await disablePushDevice(client, installationId);
  await AsyncStorage.setItem(optedOutKey, 'true');
  return 'disabled';
}

async function unregisterCurrentPushDevice(
  client: MobileSupabaseClient,
): Promise<void> {
  const installationId = await AsyncStorage.getItem(installationKey);
  if (installationId) await disablePushDevice(client, installationId);
}

function installNotificationResponseObserver(
  handler: NotificationRouteHandler,
) {
  let latestIdentifier: string | null = null;
  const redirect = (notification: Notifications.Notification) => {
    const identifier = notification.request.identifier;
    if (identifier === latestIdentifier) return;
    const route = parseJobNotificationRoute(
      notification.request.content.data?.url,
    );
    if (!route) return;
    latestIdentifier = identifier;
    handler(route);
  };

  const initialResponse = Notifications.getLastNotificationResponse();
  if (initialResponse?.notification) {
    redirect(initialResponse.notification);
    void Notifications.clearLastNotificationResponseAsync();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => redirect(response.notification),
  );
  return () => subscription.remove();
}

async function getOrCreateInstallationId() {
  const existing = await AsyncStorage.getItem(installationKey);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(installationKey, created);
  return created;
}

export const pushNotificationRuntime: PushNotificationRuntime = {
  synchronizePushDevice,
  disableCurrentPushDevice,
  unregisterCurrentPushDevice,
  openNotificationSettings: () => Linking.openSettings(),
  installNotificationResponseObserver,
};
