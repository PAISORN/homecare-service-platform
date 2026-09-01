export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type DocumentType =
  | 'national_id'
  | 'selfie'
  | 'professional_certificate'
  | 'criminal_record'
  | 'other';

export type ReviewQueueItem = Readonly<{
  technicianId: string;
  displayName: string;
  bio: string | null;
  submittedAt: string;
  documentCount: number;
  pendingDocumentCount: number;
  reviewedDocumentCount: number;
}>;

export type ReviewDocument = Readonly<{
  id: string;
  type: DocumentType;
  status: ReviewStatus;
  previewUrl: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}>;

export type ReviewHistoryEvent = Readonly<{
  id: string;
  action: string;
  entityType: string;
  decision: string | null;
  reason: string | null;
  createdAt: string;
}>;

export type ReviewApplication = Readonly<{
  technicianId: string;
  displayName: string;
  bio: string | null;
  status: 'pending_review' | 'verified' | 'rejected';
  submittedAt: string;
  kycNoticeVersion: string | null;
  kycNoticeAcknowledgedAt: string | null;
  documents: readonly ReviewDocument[];
  history: readonly ReviewHistoryEvent[];
}>;
