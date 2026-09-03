import type { Tables } from '@homecare/database-types';

import type { MobileSupabaseClient } from '../../lib/supabase';
import {
  createDocumentStoragePath,
  type PreparedKycImage,
  type RequiredTechnicianDocumentType,
} from './technician-kyc';

const DOCUMENT_BUCKET = 'technician-documents';

export type TechnicianDocument = Pick<
  Tables<'technician_documents'>,
  | 'id'
  | 'document_type'
  | 'storage_path'
  | 'review_status'
  | 'rejection_reason'
  | 'created_at'
> & { is_uploaded: boolean };

export type TechnicianBioValidation = Readonly<{
  value: string;
  error: 'required' | 'too_short' | 'too_long' | null;
}>;

export function validateTechnicianBio(
  bioInput: string,
): TechnicianBioValidation {
  const value = bioInput.trim();
  if (value.length === 0) return { value, error: 'required' };
  if (value.length < 20) return { value, error: 'too_short' };
  if (value.length > 500) return { value, error: 'too_long' };
  return { value, error: null };
}

export async function updateTechnicianBio(
  client: MobileSupabaseClient,
  userId: string,
  bioInput: string,
): Promise<string | null> {
  const validation = validateTechnicianBio(bioInput);
  if (validation.error) throw new Error('invalid_bio');
  const { data, error } = await client
    .from('technician_profiles')
    .update({ bio: validation.value })
    .eq('user_id', userId)
    .select('bio')
    .single();
  if (error) throw error;
  return data.bio;
}

export async function acknowledgeTechnicianKycNotice(
  client: MobileSupabaseClient,
): Promise<void> {
  const { error } = await client.rpc('acknowledge_technician_kyc_notice');
  if (error) throw error;
}

export async function listOwnTechnicianDocuments(
  client: MobileSupabaseClient,
  userId: string,
): Promise<TechnicianDocument[]> {
  const [rowsResult, objectsResult] = await Promise.all([
    client
      .from('technician_documents')
      .select(
        'id, document_type, storage_path, review_status, rejection_reason, created_at',
      )
      .eq('technician_id', userId)
      .in('document_type', ['national_id', 'selfie'])
      .order('created_at', { ascending: false }),
    client.storage.from(DOCUMENT_BUCKET).list(userId, { limit: 20 }),
  ]);
  if (rowsResult.error) throw rowsResult.error;
  if (objectsResult.error) throw objectsResult.error;

  const uploadedPaths = new Set(
    (objectsResult.data ?? []).map(({ name }) => `${userId}/${name}`),
  );
  return (rowsResult.data ?? []).map((document) => ({
    ...document,
    is_uploaded: uploadedPaths.has(document.storage_path),
  }));
}

export function selectCurrentRequiredDocument(
  documents: readonly TechnicianDocument[],
  documentType: RequiredTechnicianDocumentType,
): TechnicianDocument | null {
  return (
    documents.find((document) => document.document_type === documentType) ??
    null
  );
}

export function isRequiredDocumentReady(
  document: TechnicianDocument | null,
): boolean {
  return document?.is_uploaded === true;
}

export async function replaceRequiredKycDocument(
  client: MobileSupabaseClient,
  userId: string,
  documentType: RequiredTechnicianDocumentType,
  image: PreparedKycImage,
  currentDocument: TechnicianDocument | null,
  nonce: string,
): Promise<void> {
  const storagePath = createDocumentStoragePath(
    userId,
    documentType,
    image.extension,
    nonce,
  );
  const { data: reservation, error: reservationError } = await client
    .from('technician_documents')
    .insert({
      technician_id: userId,
      document_type: currentDocument ? 'other' : documentType,
      storage_path: storagePath,
    })
    .select('id')
    .single();
  if (reservationError) throw reservationError;
  if (!reservation) throw new Error('missing_document_reservation');
  const reservationId = reservation.id;

  const { error: uploadError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, image.body, {
      contentType: image.mimeType,
      upsert: false,
    });
  if (uploadError) {
    await cleanupNewReservation();
    throw uploadError;
  }

  if (!currentDocument) return;

  const { error: promotionError } = await client.rpc(
    'promote_required_technician_document',
    {
      p_current_document_id: currentDocument.id,
      p_staged_document_id: reservationId,
      p_document_type: documentType,
    },
  );
  if (promotionError) {
    await cleanupNewReservation();
    throw promotionError;
  }

  // Promotion already made the new file authoritative. Old-file cleanup is
  // best effort: a failure keeps an owned `other` row instead of losing the
  // new required document or creating an unowned retained object.
  const { error: oldObjectError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .remove([currentDocument.storage_path]);
  if (!oldObjectError) {
    await client
      .from('technician_documents')
      .delete()
      .eq('id', currentDocument.id);
  }

  async function cleanupNewReservation(): Promise<void> {
    // Cleanup is object-first so a failed Storage removal always leaves its
    // authoritative reservation in place.
    const { error: removeError } = await client.storage
      .from(DOCUMENT_BUCKET)
      .remove([storagePath]);
    if (!removeError) {
      await client
        .from('technician_documents')
        .delete()
        .eq('id', reservationId);
    }
  }
}

export async function removeDraftDocument(
  client: MobileSupabaseClient,
  document: Pick<TechnicianDocument, 'id' | 'storage_path'>,
): Promise<void> {
  const { error: storageError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .remove([document.storage_path]);
  if (storageError) throw storageError;

  const { error: rowError } = await client
    .from('technician_documents')
    .delete()
    .eq('id', document.id);
  if (rowError) throw rowError;
}

export async function submitTechnicianProfile(
  client: MobileSupabaseClient,
): Promise<'pending_review'> {
  const { data, error } = await client.rpc('submit_technician_profile');
  if (error) throw error;
  if (data !== 'pending_review')
    throw new Error('unexpected_submission_status');
  return data;
}
