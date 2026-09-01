export type AdminDashboardScaffold = Readonly<{
  readinessItems: readonly {
    id: 'catalog' | 'technician-review' | 'launch-readiness';
    value: 'draft' | 'empty' | 'disabled';
    status:
      'awaiting_review' | 'ready_for_submission' | 'awaiting_confirmation';
  }[];
  reviewQueueStatus: 'empty';
}>;

/** Query boundary to replace with server-only Supabase data access later. */
export async function loadAdminDashboardScaffold(): Promise<AdminDashboardScaffold> {
  return {
    readinessItems: [
      {
        id: 'catalog',
        value: 'draft',
        status: 'awaiting_review',
      },
      {
        id: 'technician-review',
        value: 'empty',
        status: 'ready_for_submission',
      },
      {
        id: 'launch-readiness',
        value: 'disabled',
        status: 'awaiting_confirmation',
      },
    ],
    reviewQueueStatus: 'empty',
  };
}
