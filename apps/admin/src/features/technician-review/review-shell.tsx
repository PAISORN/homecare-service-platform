import Link from 'next/link';
import type { ReactNode } from 'react';

import { signOutAction } from '@/features/auth/actions';
import type { AdminViewer } from '@/features/auth/auth';

export function ReviewShell({
  viewer,
  children,
  subtitle = 'คิวตรวจสอบช่าง',
}: Readonly<{ viewer: AdminViewer; children: ReactNode; subtitle?: string }>) {
  return (
    <main className="page-shell">
      <header className="operations-header">
        <div>
          <Link href="/technicians" className="brand-link">
            HOMECARE OPERATIONS
          </Link>
          <p>{subtitle}</p>
        </div>
        <div className="viewer-actions">
          <Link href="/technicians">ตรวจสอบช่าง</Link>
          <Link href={{ pathname: '/cases' }}>เคสคุณภาพงาน</Link>
          <span>ผู้ตรวจ: {viewer.displayName}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-button">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}
