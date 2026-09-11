import Link from 'next/link';

import { requireCaseManager } from '@/features/auth/auth';
import { moderateReviewAction } from '@/features/service-quality/actions';
import {
  listPendingReviews,
  listQualityCases,
} from '@/features/service-quality/case-dal';
import {
  formatQualityDeadline,
  qualityCaseStatusLabels,
  qualityNextActorLabels,
  qualitySlaLabels,
} from '@/features/service-quality/service-quality-copy';
import { qualityCasePath } from '@/features/service-quality/routes';
import { ReviewShell } from '@/features/technician-review/review-shell';

export default async function QualityCasesPage() {
  const viewer = await requireCaseManager();
  const [cases, reviews] = await Promise.all([
    listQualityCases(),
    listPendingReviews(),
  ]);
  const openCount = cases.filter(
    (item) => !['resolved', 'dismissed'].includes(item.status),
  ).length;
  const overdueCount = cases.filter(
    (item) => item.sla_state === 'overdue',
  ).length;
  return (
    <ReviewShell
      subtitle="คิวรับประกัน ข้อร้องเรียน และข้อพิพาท"
      viewer={viewer}
    >
      <section className="page-heading">
        <div>
          <p className="eyebrow">SERVICE QUALITY</p>
          <h1>เคสคุณภาพงาน</h1>
          <p className="lead">
            ตรวจหลักฐาน ขอข้อมูลเพิ่ม หรือบันทึกคำตัดสิน โดยทุกยอดเงินใน Phase
            5A เป็นแบบจำลอง ระบบเรียงเคสตามกำหนด SLA ที่ต้องดำเนินการก่อน
          </p>
        </div>
        <div className="metric-card">
          <strong>{openCount}</strong>
          <span>เคสที่ยังเปิด</span>
        </div>
        <div className="metric-card metric-danger">
          <strong>{overdueCount}</strong>
          <span>เคสเกินกำหนด</span>
        </div>
      </section>
      <div className="queue-list">
        {cases.length === 0 ? (
          <div className="empty-state">
            <h2>ยังไม่มีเคส</h2>
            <p>คำขอรับประกันและข้อร้องเรียนจะปรากฏที่นี่</p>
          </div>
        ) : (
          cases.map((item) => (
            <article className="queue-card" key={item.id}>
              <div className="queue-card-main">
                <span className={`status-badge status-${item.status}`}>
                  {qualityCaseStatusLabels[item.status]}
                </span>
                <span className={`status-badge sla-${item.sla_state}`}>
                  SLA: {qualitySlaLabels[item.sla_state]}
                </span>
                <h2>
                  {item.kind === 'warranty_claim'
                    ? 'คำขอรับประกัน'
                    : 'ข้อร้องเรียน'}
                </h2>
                <p>{item.details}</p>
                <dl className="inline-facts">
                  <div>
                    <dt>Job ID</dt>
                    <dd>{item.service_job_id}</dd>
                  </div>
                  <div>
                    <dt>พักเงิน</dt>
                    <dd>
                      {item.payment_hold_simulated ? 'จำลอง' : 'ไม่จำลอง'}
                    </dd>
                  </div>
                  <div>
                    <dt>อัปเดต</dt>
                    <dd>
                      {new Intl.DateTimeFormat('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.updated_at))}
                    </dd>
                  </div>
                  <div>
                    <dt>ผู้ดำเนินการถัดไป</dt>
                    <dd>{qualityNextActorLabels[item.next_action_by]}</dd>
                  </div>
                  <div>
                    <dt>กำหนด SLA</dt>
                    <dd>{formatQualityDeadline(item.sla_due_at)}</dd>
                  </div>
                </dl>
              </div>
              <Link className="primary-link" href={qualityCasePath(item.id)}>
                เปิดเคส
              </Link>
            </article>
          ))
        )}
      </div>
      <section className="section-heading">
        <div>
          <p className="eyebrow">REVIEW MODERATION</p>
          <h2>รีวิวที่รอตรวจ</h2>
          <p>
            ตรวจข้อมูลส่วนบุคคล ถ้อยคำไม่เหมาะสม และข้อกล่าวหาร้ายแรงก่อนเผยแพร่
          </p>
        </div>
        <div className="metric-card">
          <strong>{reviews.length}</strong>
          <span>รีวิวรอตรวจ</span>
        </div>
      </section>
      <div className="queue-list">
        {reviews.length === 0 ? (
          <div className="empty-state">
            <h2>ไม่มีรีวิวค้างตรวจ</h2>
          </div>
        ) : (
          reviews.map((review) => (
            <article className="queue-card" key={review.id}>
              <div className="queue-card-main">
                <h2>
                  {review.overall_rating}/5 · Job {review.service_job_id}
                </h2>
                <p>{review.review_text ?? 'ให้คะแนนโดยไม่มีข้อความ'}</p>
              </div>
              <form action={moderateReviewAction} className="form-stack">
                <input name="reviewId" type="hidden" value={review.id} />
                <label>
                  การตัดสิน
                  <select name="status">
                    <option value="published">เผยแพร่</option>
                    <option value="hidden">ซ่อน</option>
                  </select>
                </label>
                <label>
                  บันทึกผู้ตรวจ
                  <input minLength={10} name="note" required />
                </label>
                <button type="submit">บันทึกผลรีวิว</button>
              </form>
            </article>
          ))
        )}
      </div>
    </ReviewShell>
  );
}
