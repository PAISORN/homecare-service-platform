import Image from 'next/image';
import Link from 'next/link';

import { decideApplicationAction, reviewDocumentAction } from './actions';
import {
  documentTypeLabels,
  formatAdminDate,
  historyActionLabels,
  reviewStatusLabels,
} from './review-copy';
import { ReviewActionForm } from './review-action-form';
import type { ReviewApplication } from './review-types';
import { canApproveTechnicianApplication } from './review-validation';

export function ReviewDetail({
  application,
}: Readonly<{ application: ReviewApplication }>) {
  const requiredDocuments = application.documents.filter((document) =>
    ['national_id', 'selfie'].includes(document.type),
  );
  const canApprove =
    application.status === 'pending_review' &&
    canApproveTechnicianApplication(application.documents);

  return (
    <>
      <nav aria-label="เส้นทางนำทาง" className="breadcrumb">
        <Link href="/technicians">ใบสมัครที่รอตรวจ</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{application.displayName}</span>
      </nav>

      <header className="detail-heading">
        <div>
          <p className="eyebrow">ใบสมัครช่าง</p>
          <h1>{application.displayName}</h1>
          <p className="lead">
            ส่งเมื่อ {formatAdminDate(application.submittedAt)}
          </p>
        </div>
        <span className={`status-badge status-${application.status}`}>
          {application.status === 'pending_review'
            ? 'รอตรวจ'
            : application.status === 'verified'
              ? 'อนุมัติแล้ว'
              : 'ไม่อนุมัติ'}
        </span>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="content-section" aria-labelledby="profile-title">
            <h2 id="profile-title">ข้อมูลผู้สมัคร</h2>
            <dl className="profile-facts">
              <div>
                <dt>ชื่อที่แสดง</dt>
                <dd>{application.displayName}</dd>
              </div>
              <div>
                <dt>ข้อมูลแนะนำตัว</dt>
                <dd>{application.bio || 'ไม่ได้ระบุ'}</dd>
              </div>
              <div>
                <dt>ประกาศการเก็บข้อมูล</dt>
                <dd>
                  {application.kycNoticeVersion
                    ? `ยอมรับเวอร์ชัน ${application.kycNoticeVersion} เมื่อ ${formatAdminDate(application.kycNoticeAcknowledgedAt)}`
                    : 'ไม่พบหลักฐานการยอมรับ'}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="content-section"
            aria-labelledby="documents-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="documents-title">เอกสารยืนยันตัวตน</h2>
                <p>
                  ลิงก์ตัวอย่างมีอายุสั้นและใช้สำหรับการตรวจสอบครั้งนี้เท่านั้น
                </p>
              </div>
            </div>
            <div className="document-list">
              {application.documents.map((document) => (
                <article className="document-card" key={document.id}>
                  <div className="document-preview">
                    <Image
                      src={document.previewUrl}
                      alt={`ตัวอย่าง${documentTypeLabels[document.type]}ของ ${application.displayName}`}
                      width={720}
                      height={480}
                      sizes="(max-width: 720px) 100vw, 640px"
                      unoptimized
                    />
                  </div>
                  <div className="document-body">
                    <div className="document-title-row">
                      <h3>{documentTypeLabels[document.type]}</h3>
                      <span
                        className={`status-badge status-${document.status}`}
                      >
                        {reviewStatusLabels[document.status]}
                      </span>
                    </div>
                    <p className="muted-text">
                      ส่งเมื่อ {formatAdminDate(document.submittedAt)}
                    </p>
                    {document.rejectionReason ? (
                      <p className="rejection-note">
                        เหตุผล: {document.rejectionReason}
                      </p>
                    ) : null}
                    {document.status === 'pending' &&
                    application.status === 'pending_review' ? (
                      <ReviewActionForm
                        action={reviewDocumentAction}
                        targetId={document.id}
                        technicianId={application.technicianId}
                        kind="document"
                      />
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="history-title">
            <h2 id="history-title">ประวัติการตรวจสอบ</h2>
            {application.history.length === 0 ? (
              <p className="muted-text">ยังไม่มีประวัติการตรวจสอบ</p>
            ) : (
              <ol className="history-list">
                {application.history.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {historyActionLabels[event.action] ?? 'กิจกรรมการตรวจสอบ'}
                    </strong>
                    <time dateTime={event.createdAt}>
                      {formatAdminDate(event.createdAt)}
                    </time>
                    {event.decision ? <span>ผล: {event.decision}</span> : null}
                    {event.reason ? <p>เหตุผล: {event.reason}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside
          className="decision-summary"
          aria-labelledby="final-decision-title"
        >
          <h2 id="final-decision-title">สรุปผลใบสมัคร</h2>
          <p>
            เอกสารจำเป็นที่อนุมัติแล้ว{' '}
            {
              requiredDocuments.filter((item) => item.status === 'approved')
                .length
            }
            /2
          </p>
          {!canApprove && application.status === 'pending_review' ? (
            <p className="warning-note">
              ต้องอนุมัติบัตรประชาชนและภาพยืนยันตัวตนก่อนอนุมัติใบสมัคร
            </p>
          ) : null}
          {application.status === 'pending_review' ? (
            <div className={!canApprove ? 'approval-locked' : undefined}>
              <ReviewActionForm
                action={decideApplicationAction}
                targetId={application.technicianId}
                kind="application"
              />
            </div>
          ) : (
            <p>ใบสมัครนี้ได้รับการสรุปผลแล้ว</p>
          )}
        </aside>
      </div>
    </>
  );
}
