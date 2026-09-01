import { Redirect } from 'expo-router';

import { SessionStateScreen } from '../features/session/session-state-screen';
import { useSession } from '../providers/session-provider';

export default function IndexRoute() {
  const { status } = useSession();

  if (
    status === 'hydrating' ||
    status === 'misconfigured' ||
    status === 'blocked'
  ) {
    return <SessionStateScreen state={status} />;
  }

  return <Redirect href={status === 'active' ? '/(app)' : '/phone'} />;
}
