import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewQueue } from './review-queue';

describe('ReviewQueue', () => {
  it('renders an accessible Thai queue with progress that is not color-only', () => {
    const html = renderToStaticMarkup(
      <ReviewQueue
        items={[
          {
            technicianId: '11111111-1111-4111-8111-111111111111',
            displayName: 'ช่างสมชาย',
            bio: 'ช่างไฟฟ้า',
            submittedAt: '2026-09-01T01:00:00.000Z',
            documentCount: 2,
            pendingDocumentCount: 1,
            reviewedDocumentCount: 1,
          },
        ]}
      />,
    );

    expect(html).toContain('ใบสมัครที่รอตรวจ');
    expect(html).toContain('รอตรวจ');
    expect(html).toContain('1/2');
    expect(html).toContain('aria-label="เปิดใบสมัครของ ช่างสมชาย"');
    expect(html).not.toContain('storage_path');
  });
});
