import { ServiceJobWorkScreen } from '../../../features/jobs/service-job-work-screen';

export default function CustomerServiceJobWorkRoute() {
  return <ServiceJobWorkScreen fallback="/jobs" mode="customer" />;
}
