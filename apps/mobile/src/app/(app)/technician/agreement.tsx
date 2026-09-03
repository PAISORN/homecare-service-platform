import { ServiceAgreementScreen } from '../../../features/agreements/service-agreement-screen';

export default function TechnicianServiceAgreementRoute() {
  return <ServiceAgreementScreen fallback="/technician/feed" />;
}
