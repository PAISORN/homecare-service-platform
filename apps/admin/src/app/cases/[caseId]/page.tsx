import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireCaseManager } from '@/features/auth/auth';
import {
  escalateQualityCaseAction,
  updateQualityCaseAction,
} from '@/features/service-quality/actions';
import { getQualityCase } from '@/features/service-quality/case-dal';
import {
  formatQualityDeadline,
  qualityCaseStatusLabels,
  qualityEventLabels,
  qualityNextActorLabels,
  qualitySlaLabels,
} from '@/features/service-quality/service-quality-copy';
import { ReviewShell } from '@/features/technician-review/review-shell';

export default async function QualityCaseDetailPage({
  params,
}: Readonly<{ params: Promise<{ caseId: string }> }>) {
  const viewer = await requireCaseManager();
  const { caseId } = await params;
  const detail = await getQualityCase(caseId);
  if (!detail) notFound();
  const item = detail.qualityCase;
  const isClosed = ['resolved', 'dismissed'].includes(item.status);
  return (
    <ReviewShell subtitle="จัดการเคสคุณภาพงาน" viewer={viewer}>
      <nav className="breadcrumb">
        <Link href={{ pathname: '/cases' }}>เคสคุณภาพงาน</Link>
        <span>/</span>
        <span>{item.id}</span>
      </nav>
      <section className="detail-heading">
        <div>
          <p className="eyebrow">
            {item.kind === 'warranty_claim' ? 'WARRANTY CLAIM' : 'COMPLAINT'}
          </p>
          <h1>รายละเอียดเคส</h1>
          <p className="lead">Job ID: {item.service_job_id}</p>
        </div>
        <span className={`status-badge status-${item.status}`}>
          {qualityCaseStatusLabels[item.status]}
        </span>
      </section>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="content-section sla-summary">
            <h2>กรอบเวลาดำเนินการ</h2>
            <dl className="inline-facts">
              <div>
                <dt>สถานะ SLA</dt>
                <dd>{qualitySlaLabels[item.sla_state]}</dd>
              </div>
              <div>
                <dt>ผู้ดำเนินการถัดไป</dt>
                <dd>{qualityNextActorLabels[item.next_action_by]}</dd>
              </div>
              <div>
                <dt>ครบกำหนด</dt>
                <dd>{formatQualityDeadline(item.sla_due_at)}</dd>
              </div>
            </dl>
          </section>
          <section className="content-section">
            <h2>ข้อมูลจากลูกค้า</h2>
            <p>{item.details}</p>
            {item.customer_response ? (
              <p className="warning-note">
                ข้อมูลเพิ่ม: {item.customer_response}
              </p>
            ) : null}
            {item.technician_response ? (
              <p className="warning-note">
                คำชี้แจงช่าง: {item.technician_response}
              </p>
            ) : null}
          </section>
          <section className="content-section">
            <h2>หลักฐาน</h2>
            {detail.attachments.length === 0 ? (
              <p className="muted-text">ยังไม่มีรูปแนบ</p>
            ) : (
              <div className="document-list">
                {detail.attachments.map((attachment) => (
                  <a
                    href={attachment.signedUrl}
                    key={attachment.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    เปิดหลักฐาน · {Math.ceil(attachment.size_bytes / 1024)} KB
                  </a>
                ))}
              </div>
            )}
          </section>
          <section className="content-section">
            <h2>ประวัติ</h2>
            <ol className="history-list">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <strong>
                    {qualityEventLabels[event.event_type] ?? event.event_type}
                  </strong>
                  {event.note ? <p>{event.note}</p> : null}
                  <time>
                    {new Intl.DateTimeFormat('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(event.created_at))}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="decision-summary">
          <h2>บันทึกการดำเนินการ</h2>
          <p className="warning-note">
            Phase 5A ไม่เคลื่อนย้ายเงินจริง
            ยอดคืนเงินด้านล่างเป็นข้อมูลจำลองเท่านั้น
          </p>
          {isClosed ? (
            <>
              <p>
                <strong>{item.decision}</strong>
              </p>
              <p>{item.decision_note}</p>
            </>
          ) : (
            <>
              <form action={updateQualityCaseAction} className="form-stack">
                <input name="caseId" type="hidden" value={item.id} />
                <label>
                  สถานะ
                  <select defaultValue={item.status} name="status">
                    <option value="under_review">กำลังตรวจสอบ</option>
                    <option value="awaiting_customer">รอข้อมูลลูกค้า</option>
                    <option value="awaiting_technician">รอข้อมูลช่าง</option>
                    <option value="resolved">แก้ไขแล้ว</option>
                    <option value="dismissed">ยุติเรื่อง</option>
                  </select>
                </label>
                <label>
                  ผลการตัดสิน
                  <select defaultValue="no_action" name="decision">
                    <option value="no_action">ไม่ดำเนินการ</option>
                    <option value="warranty_rework">
                      ช่างเดิมแก้งานรับประกัน
                    </option>
                    <option value="assign_other_technician">
                      มอบหมายช่างอื่น
                    </option>
                    <option value="partial_refund_simulated">
                      คืนบางส่วน (จำลอง)
                    </option>
                    <option value="full_refund_simulated">
                      คืนเต็มจำนวน (จำลอง)
                    </option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </label>
                <label>
                  ยอดคืนเงินจำลอง
                  <input min="0" name="amount" step="0.01" type="number" />
                </label>
                <label>
                  เหตุผล/คำตัดสิน
                  <textarea maxLength={2000} minLength={10} name="note" />
                </label>
                <button type="submit">บันทึก</button>
              </form>
              <form
                action={escalateQualityCaseAction}
                className="decision-panel"
              >
                <input name="caseId" type="hidden" value={item.id} />
                <button className="danger-button" type="submit">
                  ยกระดับเป็นข้อพิพาท
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </ReviewShell>
  );
}
