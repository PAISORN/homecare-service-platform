import { requireOperationsManager } from '@/features/auth/auth';
import { setOperationalControlAction } from '@/features/operations/actions';
import {
  type OperationalControlKey,
  operationalControlCopy,
} from '@/features/operations/operational-control-copy';
import { listOperationalControls } from '@/features/operations/operations-dal';
import { ReviewShell } from '@/features/technician-review/review-shell';

export default async function OperationsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ updated?: string }> }>) {
  const [viewer, controls, query] = await Promise.all([
    requireOperationsManager(),
    listOperationalControls(),
    searchParams,
  ]);

  return (
    <ReviewShell subtitle="Security และความพร้อมปฏิบัติการ" viewer={viewer}>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PILOT OPERATIONS</p>
          <h1>ควบคุมการเปิดบริการ</h1>
          <p className="lead">
            Kill switch ทุกตัวบังคับที่ฐานข้อมูล การเปลี่ยนแปลงต้องมีเหตุผล
            และถูกบันทึกใน Audit Log
          </p>
        </div>
        <div className="metric-card">
          <strong>
            {controls.filter((control) => control.enabled).length}
          </strong>
          <span>ระบบที่เปิดอยู่</span>
        </div>
      </section>

      {query.updated ? (
        <p className="form-success" role="status">
          บันทึกสถานะระบบแล้ว
        </p>
      ) : null}

      <div className="operations-grid">
        {controls.map((control) => {
          const key = control.control_key as OperationalControlKey;
          const copy = operationalControlCopy[key];
          const paymentLocked = key === 'payment' && !control.enabled;
          return (
            <article className="content-section operational-card" key={key}>
              <div className="operational-card-heading">
                <div>
                  <p className="eyebrow">{key.toUpperCase()}</p>
                  <h2>{copy.title}</h2>
                </div>
                <span
                  className={`status-badge ${control.enabled ? 'status-approved' : 'status-rejected'}`}
                >
                  {control.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </div>
              <p>{copy.description}</p>
              <p className="field-help">{copy.effect}</p>
              <dl className="profile-facts">
                <div>
                  <dt>เหตุผลล่าสุด</dt>
                  <dd>{control.reason}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd>{control.revision}</dd>
                </div>
                <div>
                  <dt>อัปเดตล่าสุด</dt>
                  <dd>
                    {new Intl.DateTimeFormat('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(control.updated_at))}
                  </dd>
                </div>
              </dl>
              {paymentLocked ? (
                <p className="warning-note">
                  ยังเปิดไม่ได้จนกว่าจะเชื่อม provider และตรวจ webhook signature
                  ผ่าน
                </p>
              ) : (
                <form
                  action={setOperationalControlAction}
                  className="form-stack"
                >
                  <input name="controlKey" type="hidden" value={key} />
                  <input
                    name="enabled"
                    type="hidden"
                    value={control.enabled ? 'false' : 'true'}
                  />
                  <label>
                    เหตุผลในการเปลี่ยนสถานะ
                    <textarea
                      maxLength={500}
                      minLength={10}
                      name="reason"
                      required
                      rows={3}
                    />
                  </label>
                  <button
                    className={control.enabled ? 'danger-button' : undefined}
                    type="submit"
                  >
                    {control.enabled ? 'ปิดระบบนี้' : 'เปิดระบบนี้'}
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </ReviewShell>
  );
}
