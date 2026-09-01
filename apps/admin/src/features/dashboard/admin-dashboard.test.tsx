import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { loadAdminDashboardScaffold } from '@/data/admin-dashboard-scaffold';
import { adminDashboardCopyTh } from '@/locales/th';

import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  it('renders localized query data and accessible section relationships', async () => {
    const html = renderToStaticMarkup(
      <AdminDashboard
        copy={adminDashboardCopyTh}
        model={await loadAdminDashboardScaffold()}
      />,
    );

    expect(html).toContain(adminDashboardCopyTh.title);
    expect(html).toContain('aria-labelledby="readiness-title"');
    expect(html).toContain('aria-labelledby="queue-title"');
    expect(html).not.toContain('AIR');
  });
});
