import 'server-only';

import { requireTechnicianReviewer } from '@/features/auth/auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

import type {
  DocumentType,
  ReviewApplication,
  ReviewHistoryEvent,
  ReviewQueueItem,
  ReviewStatus,
} from './review-types';

function isReviewApplicationStatus(
  value: string,
): value is ReviewApplication['status'] {
  return ['pending_review', 'verified', 'rejected'].includes(value);
}

export async function loadReviewQueue(): Promise<readonly ReviewQueueItem[]> {
  await requireTechnicianReviewer();
  const client = await createAdminSupabaseClient();
  const { data: rows, error } = await client.rpc(
    'list_pending_technician_applications',
  );
  if (error) throw new Error('technician_review_queue_unavailable');

  return rows.map((row) => ({
    technicianId: row.technician_id,
    displayName: row.display_name,
    bio: row.bio,
    submittedAt: row.submitted_at,
    documentCount: row.document_count,
    pendingDocumentCount: row.pending_document_count,
    reviewedDocumentCount: row.reviewed_document_count,
  }));
}

export async function loadReviewApplication(
  technicianId: string,
): Promise<ReviewApplication | null> {
  await requireTechnicianReviewer();
  const client = await createAdminSupabaseClient();
  const [applicationResult, documentResult, historyResult] = await Promise.all([
    client.rpc('get_technician_review_application', {
      p_technician_id: technicianId,
    }),
    client.rpc('list_technician_review_documents', {
      p_technician_id: technicianId,
    }),
    client.rpc('list_technician_review_history', {
      p_technician_id: technicianId,
    }),
  ]);
  if (applicationResult.error || documentResult.error || historyResult.error) {
    throw new Error('technician_review_application_unavailable');
  }
  const applications = applicationResult.data;
  const documentRows = documentResult.data;
  const historyRows = historyResult.data;
  const application = applications[0];
  if (!application) return null;
  if (!isReviewApplicationStatus(application.verification_status)) {
    throw new Error('technician_review_application_status_invalid');
  }

  const documents = await Promise.all(
    documentRows.map(async (document) => {
      const { data, error } = await client.storage
        .from('technician-documents')
        .createSignedUrl(document.storage_path, 120);
      if (error || !data?.signedUrl) {
        throw new Error('technician_document_preview_unavailable');
      }

      return {
        id: document.document_id,
        type: document.document_type as DocumentType,
        status: document.review_status as ReviewStatus,
        previewUrl: data.signedUrl,
        submittedAt: document.submitted_at,
        reviewedAt: document.reviewed_at,
        rejectionReason: document.rejection_reason,
      };
    }),
  );

  const history: ReviewHistoryEvent[] = historyRows.map((event) => ({
    id: event.event_id,
    action: event.action,
    entityType: event.entity_type,
    decision: event.decision,
    reason: event.reason,
    createdAt: event.created_at,
  }));

  return {
    technicianId: application.technician_id,
    displayName: application.display_name,
    bio: application.bio,
    status: application.verification_status,
    submittedAt: application.submitted_at,
    kycNoticeVersion: application.kyc_notice_version,
    kycNoticeAcknowledgedAt: application.kyc_notice_acknowledged_at,
    documents,
    history,
  };
}
