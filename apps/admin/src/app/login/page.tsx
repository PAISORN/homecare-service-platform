import { signInAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">HOMECARE OPERATIONS</p>
        <h1 id="login-title">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="lead">สำหรับผู้ดูแลที่ได้รับสิทธิ์ตรวจสอบช่างเท่านั้น</p>

        {error ? (
          <p className="form-error" role="alert">
            {error === 'required'
              ? 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ'
              : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'}
          </p>
        ) : null}

        <form action={signInAction} className="form-stack">
          <label htmlFor="email">อีเมล</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="password">รหัสผ่าน</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </section>
    </main>
  );
}
