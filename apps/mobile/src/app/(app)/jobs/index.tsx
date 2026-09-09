import { ServiceJobsScreen } from '../../../features/jobs/service-jobs-screen';

export default function CustomerServiceJobsRoute() {
  return <ServiceJobsScreen fallback="/home" mode="customer" />;
}
