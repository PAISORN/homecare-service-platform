import { ServiceQualityScreen } from '../../../features/jobs/service-quality-screen';

export default function CustomerServiceQualityRoute() {
  return <ServiceQualityScreen fallback="/jobs/detail" mode="customer" />;
}
