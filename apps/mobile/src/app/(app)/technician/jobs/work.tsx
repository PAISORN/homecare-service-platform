import { ServiceJobWorkScreen } from '../../../../features/jobs/service-job-work-screen';

export default function TechnicianServiceJobWorkRoute() {
  return <ServiceJobWorkScreen fallback="/technician/jobs" mode="technician" />;
}
