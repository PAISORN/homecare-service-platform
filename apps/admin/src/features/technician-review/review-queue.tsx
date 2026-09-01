import Link from 'next/link';

import { formatAdminDate } from './review-copy';
import type { ReviewQueueItem } from './review-types';

export function ReviewQueue({
  items,
}: Readonly<{ items: readonly ReviewQueueItem[] }>) {
  return (
    <section aria-labelledby="queue-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">การตรวจสอบตัวตน</p>
          <h1 id="queue-title">ใบสมัครที่รอตรวจ</h1>
          <p className="lead">
            ตรวจเอกสารทีละรายการก่อนสรุปผลใบสมัคร รายการเก่าจะแสดงก่อน
          </p>
        </div>
        <div
          className="metric-card"
          aria-label={`มีใบสมัครรอตรวจ ${items.length} รายการ`}
        >
          <strong>{items.length}</strong>
          <span>รายการรอตรวจ</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>ไม่มีใบสมัครที่รอตรวจ</h2>
          <p>เมื่อช่างส่งใบสมัคร รายการใหม่จะปรากฏที่หน้านี้</p>
        </div>
      ) : (
        <div className="queue-list">
          {items.map((item) => (
            <article className="queue-card" key={item.technicianId}>
              <div className="queue-card-main">
                <span className="status-badge status-pending">รอตรวจ</span>
                <h2>{item.displayName}</h2>
                <p>{item.bio || 'ยังไม่ได้ระบุข้อมูลแนะนำตัว'}</p>
                <dl className="inline-facts">
                  <div>
                    <dt>ส่งเมื่อ</dt>
                    <dd>{formatAdminDate(item.submittedAt)}</dd>
                  </div>
                  <div>
                    <dt>เอกสาร</dt>
                    <dd>{item.documentCount} รายการ</dd>
                  </div>
                  <div>
                    <dt>ตรวจแล้ว</dt>
                    <dd>
                      {item.reviewedDocumentCount}/{item.documentCount}
                    </dd>
                  </div>
                </dl>
              </div>
              <Link
                className="primary-link"
                href={`/technicians/${item.technicianId}`}
                aria-label={`เปิดใบสมัครของ ${item.displayName}`}
              >
                เปิดตรวจสอบ
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
