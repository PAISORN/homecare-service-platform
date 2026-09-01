import { Redirect, Stack } from 'expo-router';

import { SessionStateScreen } from '../../features/session/session-state-screen';
import { useSession } from '../../providers/session-provider';

export default function AppLayout() {
  const { status } = useSession();

  if (
    status === 'hydrating' ||
    status === 'misconfigured' ||
    status === 'blocked'
  ) {
    return <SessionStateScreen state={status} />;
  }
  if (status === 'signed_out') return <Redirect href="/phone" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
