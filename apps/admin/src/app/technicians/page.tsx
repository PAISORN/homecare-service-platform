import { requireTechnicianReviewer } from '@/features/auth/auth';
import { loadReviewQueue } from '@/features/technician-review/review-dal';
import { ReviewQueue } from '@/features/technician-review/review-queue';
import { ReviewShell } from '@/features/technician-review/review-shell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TechnicianReviewQueuePage() {
  const [viewer, items] = await Promise.all([
    requireTechnicianReviewer(),
    loadReviewQueue(),
  ]);

  return (
    <ReviewShell viewer={viewer}>
      <ReviewQueue items={items} />
    </ReviewShell>
  );
}
