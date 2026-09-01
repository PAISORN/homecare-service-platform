import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  AccountProfile,
  TechnicianApplication,
} from '../features/account/account-api';
import {
  installSupabaseAutoRefresh,
  supabase,
  type MobileSupabaseClient,
} from '../lib/supabase';
import { createSessionHydrationGuard } from './session-hydration-guard';

export type SessionStatus =
  'misconfigured' | 'hydrating' | 'signed_out' | 'active' | 'blocked';

type SessionContextValue = Readonly<{
  client: MobileSupabaseClient | null;
  status: SessionStatus;
  session: Session | null;
  profile: AccountProfile | null;
  technicianApplication: TechnicianApplication | null;
  accountRoles: readonly ('customer' | 'technician' | 'administrator')[];
  refreshAccount: () => Promise<void>;
}>;

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>(
    supabase ? 'hydrating' : 'misconfigured',
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [technicianApplication, setTechnicianApplication] =
    useState<TechnicianApplication | null>(null);
  const [accountRoles, setAccountRoles] = useState<
    ('customer' | 'technician' | 'administrator')[]
  >([]);
  const hydrationGuardRef = useRef(createSessionHydrationGuard());
  const currentSessionUserIdRef = useRef<string | null>(null);

  const hydrateAccount = useCallback(async (nextSession: Session | null) => {
    currentSessionUserIdRef.current = nextSession?.user.id ?? null;
    setSession(nextSession);
    if (!supabase || !nextSession) {
      hydrationGuardRef.current.invalidate();
      setProfile(null);
      setTechnicianApplication(null);
      setAccountRoles([]);
      setStatus(supabase ? 'signed_out' : 'misconfigured');
      return;
    }

    const hydrationRequest = hydrationGuardRef.current.begin(
      nextSession.user.id,
    );

    const [profileResult, rolesResult, technicianResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, phone, account_status')
        .eq('id', nextSession.user.id)
        .maybeSingle(),
      supabase
        .from('account_roles')
        .select('role')
        .eq('user_id', nextSession.user.id),
      supabase
        .from('technician_profiles')
        .select(
          'user_id, bio, verification_status, rejection_reason, kyc_notice_version, kyc_notice_acknowledged_at',
        )
        .eq('user_id', nextSession.user.id)
        .maybeSingle(),
    ]);

    if (
      !hydrationGuardRef.current.isCurrent(
        hydrationRequest,
        currentSessionUserIdRef.current,
      )
    ) {
      return;
    }

    if (profileResult.error || !profileResult.data) {
      setProfile(null);
      setTechnicianApplication(null);
      setAccountRoles([]);
      setStatus('blocked');
      return;
    }

    setProfile(profileResult.data);
    setAccountRoles(rolesResult.data?.map(({ role }) => role) ?? []);
    setTechnicianApplication(technicianResult.data ?? null);
    setStatus(
      profileResult.data.account_status === 'active' ? 'active' : 'blocked',
    );
  }, []);

  const refreshAccount = useCallback(async () => {
    await hydrateAccount(session);
  }, [hydrateAccount, session]);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    const hydrationGuard = hydrationGuardRef.current;
    const removeAutoRefresh = installSupabaseAutoRefresh(supabase);
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) void hydrateAccount(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (mounted) void hydrateAccount(nextSession);
      });
    });

    return () => {
      mounted = false;
      hydrationGuard.invalidate();
      currentSessionUserIdRef.current = null;
      data.subscription.unsubscribe();
      removeAutoRefresh();
    };
  }, [hydrateAccount]);

  const value = useMemo<SessionContextValue>(
    () => ({
      client: supabase,
      status,
      session,
      profile,
      technicianApplication,
      accountRoles,
      refreshAccount,
    }),
    [
      status,
      session,
      profile,
      technicianApplication,
      accountRoles,
      refreshAccount,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing');
  return context;
}
