import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { pushNotificationRuntime } from '../features/notifications/notification-runtime';
import type { PushNotificationState } from '../features/notifications/notification-runtime-types';
import { useSession } from './session-provider';

type NotificationContextValue = Readonly<{
  state: PushNotificationState;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  openSettings: () => Promise<void>;
  prepareForSignOut: () => Promise<void>;
}>;

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const { client, status } = useSession();
  const [state, setState] = useState<PushNotificationState>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      pushNotificationRuntime.installNotificationResponseObserver((route) => {
        router.push(route as never);
      }),
    [router],
  );

  useEffect(() => {
    let active = true;
    if (status !== 'active' || !client) {
      return () => {
        active = false;
      };
    }
    void pushNotificationRuntime
      .synchronizePushDevice(client, { requestPermission: false })
      .then((nextState) => {
        if (active) setState(nextState);
      });
    return () => {
      active = false;
    };
  }, [client, status]);

  const enable = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    try {
      setState(
        await pushNotificationRuntime.synchronizePushDevice(client, {
          requestPermission: true,
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [client]);

  const disable = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    try {
      setState(await pushNotificationRuntime.disableCurrentPushDevice(client));
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }, [client]);

  const prepareForSignOut = useCallback(async () => {
    if (!client) return;
    await pushNotificationRuntime
      .unregisterCurrentPushDevice(client)
      .catch(() => undefined);
  }, [client]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      state,
      busy,
      enable,
      disable,
      openSettings: pushNotificationRuntime.openNotificationSettings,
      prepareForSignOut,
    }),
    [state, busy, enable, disable, prepareForSignOut],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('NotificationProvider is missing');
  return context;
}
