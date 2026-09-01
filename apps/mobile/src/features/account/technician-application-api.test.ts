import { describe, expect, it } from 'vitest';

import type { MobileSupabaseClient } from '../../lib/supabase';
import {
  isRequiredDocumentReady,
  removeDraftDocument,
  replaceRequiredKycDocument,
  selectCurrentRequiredDocument,
  type TechnicianDocument,
} from './technician-application-api';

function document(
  id: string,
  type: TechnicianDocument['document_type'],
  uploaded = true,
): TechnicianDocument {
  return {
    id,
    document_type: type,
    storage_path: `user/${id}.jpg`,
    review_status: 'pending',
    rejection_reason: null,
    created_at: id,
    is_uploaded: uploaded,
  };
}

describe('selectCurrentRequiredDocument', () => {
  it('uses the newest reservation so an incomplete upload can be replaced', () => {
    const documents = [
      document('3', 'national_id', false),
      document('2', 'national_id'),
      document('1', 'selfie'),
    ];
    expect(selectCurrentRequiredDocument(documents, 'national_id')?.id).toBe(
      '3',
    );
  });

  it('does not treat an upload reservation without an object as ready', () => {
    const reservation = selectCurrentRequiredDocument(
      [document('1', 'selfie', false)],
      'selfie',
    );
    expect(reservation?.id).toBe('1');
    expect(isRequiredDocumentReady(reservation)).toBe(false);
  });
});

describe('KYC Storage operation order', () => {
  it('removes a private object before deleting its authoritative row', async () => {
    const events: string[] = [];
    const client = {
      storage: {
        from: () => ({
          remove: async () => {
            events.push('object-remove');
            return { error: null };
          },
        }),
      },
      from: () => ({
        delete: () => ({
          eq: async () => {
            events.push('row-delete');
            return { error: null };
          },
        }),
      }),
    } as unknown as MobileSupabaseClient;

    await removeDraftDocument(client, {
      id: 'document-id',
      storage_path: 'user/document.jpg',
    });
    expect(events).toEqual(['object-remove', 'row-delete']);
  });

  it('creates the authoritative reservation before uploading with upsert disabled', async () => {
    const events: string[] = [];
    const client = operationClient(events, null);

    await replaceRequiredKycDocument(
      client,
      '00000000-0000-4000-8000-000000000001',
      'selfie',
      {
        body: new ArrayBuffer(3),
        mimeType: 'image/jpeg',
        extension: 'jpg',
        byteLength: 3,
      },
      null,
      '10000000-0000-4000-8000-000000000001',
    );

    expect(events).toEqual(['reservation-insert:selfie', 'upload:false']);
  });

  it('cleans up object before reservation row after a failed upload', async () => {
    const events: string[] = [];
    const client = operationClient(events, new Error('upload_failed'));

    await expect(
      replaceRequiredKycDocument(
        client,
        '00000000-0000-4000-8000-000000000001',
        'national_id',
        {
          body: new ArrayBuffer(3),
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteLength: 3,
        },
        null,
        '10000000-0000-4000-8000-000000000002',
      ),
    ).rejects.toThrow('upload_failed');
    expect(events).toEqual([
      'reservation-insert:national_id',
      'upload:false',
      'object-remove',
      'row-delete',
    ]);
  });

  it('uploads staging before atomically promoting and cleaning the old file', async () => {
    const events: string[] = [];
    const client = operationClient(events, null);

    await replaceRequiredKycDocument(
      client,
      '00000000-0000-4000-8000-000000000001',
      'national_id',
      {
        body: new ArrayBuffer(3),
        mimeType: 'image/jpeg',
        extension: 'jpg',
        byteLength: 3,
      },
      document('current', 'national_id'),
      '10000000-0000-4000-8000-000000000003',
    );

    expect(events).toEqual([
      'reservation-insert:other',
      'upload:false',
      'promote:national_id',
      'object-remove',
      'row-delete',
    ]);
  });

  it('keeps the current document when staging promotion fails', async () => {
    const events: string[] = [];
    const client = operationClient(events, null, new Error('promotion_failed'));

    await expect(
      replaceRequiredKycDocument(
        client,
        '00000000-0000-4000-8000-000000000001',
        'selfie',
        {
          body: new ArrayBuffer(3),
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteLength: 3,
        },
        document('current', 'selfie'),
        '10000000-0000-4000-8000-000000000004',
      ),
    ).rejects.toThrow('promotion_failed');

    expect(events).toEqual([
      'reservation-insert:other',
      'upload:false',
      'promote:selfie',
      'object-remove',
      'row-delete',
    ]);
  });
});

function operationClient(
  events: string[],
  uploadError: Error | null,
  promotionError: Error | null = null,
) {
  return {
    storage: {
      from: () => ({
        upload: async (
          _path: string,
          _body: ArrayBuffer,
          options: { upsert: boolean },
        ) => {
          events.push(`upload:${String(options.upsert)}`);
          return { error: uploadError };
        },
        remove: async () => {
          events.push('object-remove');
          return { error: null };
        },
      }),
    },
    rpc: async (_name: string, args: { p_document_type: string }) => {
      events.push(`promote:${args.p_document_type}`);
      return { data: null, error: promotionError };
    },
    from: () => ({
      insert: (value: { document_type: string }) => {
        events.push(`reservation-insert:${value.document_type}`);
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'reservation-id' },
              error: null,
            }),
          }),
        };
      },
      delete: () => ({
        eq: async () => {
          events.push('row-delete');
          return { error: null };
        },
      }),
    }),
  } as unknown as MobileSupabaseClient;
}
