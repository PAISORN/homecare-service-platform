import { ServiceJobDetailScreen } from '../../../../features/jobs/service-job-detail-screen';

export default function TechnicianServiceJobDetailRoute() {
  return (
    <ServiceJobDetailScreen fallback="/technician/jobs" mode="technician" />
  );
}
