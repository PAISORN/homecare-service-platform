import { useLocalSearchParams } from 'expo-router';

import { ServiceLocationFormScreen } from '../../../../features/account/service-location-form-screen';

export default function EditServiceLocationRoute() {
  const params = useLocalSearchParams<{ locationId?: string | string[] }>();
  const locationId = Array.isArray(params.locationId)
    ? params.locationId[0]
    : params.locationId;

  return <ServiceLocationFormScreen locationId={locationId} />;
}
