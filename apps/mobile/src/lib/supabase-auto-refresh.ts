export type SupabaseAutoRefreshAuth = Readonly<{
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}>;

export function synchronizeSupabaseAutoRefresh(
  auth: SupabaseAutoRefreshAuth,
  appState: string | null | undefined,
): void {
  if (appState === 'active') {
    auth.startAutoRefresh();
  } else {
    auth.stopAutoRefresh();
  }
}
