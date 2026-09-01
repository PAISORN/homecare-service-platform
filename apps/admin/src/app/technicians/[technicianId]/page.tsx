import { notFound } from 'next/navigation';

import { requireTechnicianReviewer } from '@/features/auth/auth';
import { loadReviewApplication } from '@/features/technician-review/review-dal';
import { ReviewDetail } from '@/features/technician-review/review-detail';
import { ReviewShell } from '@/features/technician-review/review-shell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TechnicianReviewDetailPage({
  params,
}: {
  params: Promise<{ technicianId: string }>;
}) {
  const { technicianId } = await params;
  const [viewer, application] = await Promise.all([
    requireTechnicianReviewer(),
    loadReviewApplication(technicianId),
  ]);
  if (!application) notFound();

  return (
    <ReviewShell viewer={viewer}>
      <ReviewDetail application={application} />
    </ReviewShell>
  );
}
