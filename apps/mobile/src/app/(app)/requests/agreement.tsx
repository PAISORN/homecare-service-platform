import { ServiceAgreementScreen } from '../../../features/agreements/service-agreement-screen';

export default function CustomerServiceAgreementRoute() {
  return <ServiceAgreementScreen fallback="/requests" />;
}
