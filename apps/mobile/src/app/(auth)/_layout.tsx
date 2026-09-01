import { Redirect, Stack } from 'expo-router';

import { SessionStateScreen } from '../../features/session/session-state-screen';
import { useSession } from '../../providers/session-provider';

export default function AuthLayout() {
  const { status } = useSession();

  if (
    status === 'hydrating' ||
    status === 'misconfigured' ||
    status === 'blocked'
  ) {
    return <SessionStateScreen state={status} />;
  }
  if (status === 'active') return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
