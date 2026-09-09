import { ServiceJobDetailScreen } from '../../../features/jobs/service-job-detail-screen';

export default function CustomerServiceJobDetailRoute() {
  return <ServiceJobDetailScreen fallback="/jobs" mode="customer" />;
}
