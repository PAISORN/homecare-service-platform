import Link from 'next/link';
import type { ReactNode } from 'react';

import { signOutAction } from '@/features/auth/actions';
import type { AdminViewer } from '@/features/auth/auth';

export function ReviewShell({
  viewer,
  children,
}: Readonly<{ viewer: AdminViewer; children: ReactNode }>) {
  return (
    <main className="page-shell">
      <header className="operations-header">
        <div>
          <Link href="/technicians" className="brand-link">
            HOMECARE OPERATIONS
          </Link>
          <p>คิวตรวจสอบช่าง</p>
        </div>
        <div className="viewer-actions">
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
