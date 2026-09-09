import { ServiceJobsScreen } from '../../../../features/jobs/service-jobs-screen';

export default function TechnicianServiceJobsRoute() {
  return <ServiceJobsScreen fallback="/technician/feed" mode="technician" />;
}
