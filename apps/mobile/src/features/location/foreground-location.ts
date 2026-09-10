import * as Location from 'expo-location';

export type ForegroundCoordinates = Readonly<{
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
}>;

function toCoordinates(
  location: Location.LocationObject,
): ForegroundCoordinates {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
    capturedAt: new Date(location.timestamp).toISOString(),
  };
}

async function ensureForegroundPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return;
  const requested = await Location.requestForegroundPermissionsAsync();
  if (!requested.granted) throw new Error('foreground_location_denied');
}

export async function getCurrentForegroundCoordinates(): Promise<ForegroundCoordinates> {
  await ensureForegroundPermission();
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return toCoordinates(location);
}

export async function watchForegroundCoordinates(
  onLocation: (coordinates: ForegroundCoordinates) => void,
): Promise<Location.LocationSubscription> {
  await ensureForegroundPermission();
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      timeInterval: 15_000,
    },
    (location) => onLocation(toCoordinates(location)),
  );
}
