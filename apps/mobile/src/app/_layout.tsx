import {
  NotoSansThai_400Regular,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-thai';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  AppFontProvider,
  fontFamiliesFor,
  resolveFontStartupState,
} from '../foundation/font-runtime';
import { AuthDraftProvider } from '../providers/auth-draft-provider';
import { NotificationProvider } from '../providers/notification-provider';
import { SessionProvider } from '../providers/session-provider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansThai_400Regular,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold,
  });
  const fontStartupState = resolveFontStartupState(fontsLoaded, fontError);

  useEffect(() => {
    if (fontStartupState !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [fontStartupState]);

  if (fontStartupState === 'loading') return null;

  return (
    <AppFontProvider value={fontFamiliesFor(fontStartupState)}>
      <SafeAreaProvider>
        <SessionProvider>
          <NotificationProvider>
            <AuthDraftProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthDraftProvider>
          </NotificationProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </AppFontProvider>
  );
}
