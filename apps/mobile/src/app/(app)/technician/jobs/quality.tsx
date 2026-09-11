import { ServiceQualityScreen } from '../../../../features/jobs/service-quality-screen';

export default function TechnicianServiceQualityRoute() {
  return (
    <ServiceQualityScreen
      fallback="/technician/jobs/detail"
      mode="technician"
    />
  );
}
