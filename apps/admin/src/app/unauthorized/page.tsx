import { signOutAction } from '@/features/auth/actions';

export default function UnauthorizedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="unauthorized-title">
        <p className="eyebrow">การเข้าถึงถูกจำกัด</p>
        <h1 id="unauthorized-title">บัญชีนี้ไม่มีสิทธิ์ตรวจสอบช่าง</h1>
        <p className="lead">
          ติดต่อผู้ดูแลสิทธิ์ หากคุณต้องรับผิดชอบคิวตรวจสอบช่าง
        </p>
        <form action={signOutAction}>
          <button type="submit" className="secondary-button">
            ออกจากระบบ
          </button>
        </form>
      </section>
    </main>
  );
}
