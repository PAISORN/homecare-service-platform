import type { MobileSupabaseClient } from '../../lib/supabase';
import type { ForegroundCoordinates } from '../location/foreground-location';
import type { ServiceJobStatus } from './service-jobs-api';

export type ServiceJobTravelProgress = Readonly<{
  job_status: ServiceJobStatus;
  destination_ready: boolean;
  sharing_active: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  captured_at: string | null;
  is_stale: boolean;
  straight_line_distance_km: number | null;
  estimated_minutes: number | null;
  refresh_interval_seconds: number;
}>;

export async function getServiceJobTravelProgress(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<ServiceJobTravelProgress> {
  const { data, error } = await client.rpc('get_service_job_travel_progress', {
    p_job_id: jobId,
  });
  if (error) throw error;
  const progress = data[0] as ServiceJobTravelProgress | undefined;
  if (!progress) throw new Error('service_job_travel_progress_not_found');
  return progress;
}

export async function publishServiceJobTravelLocation(
  client: MobileSupabaseClient,
  jobId: string,
  coordinates: ForegroundCoordinates,
): Promise<void> {
  const { error } = await client.rpc('publish_service_job_travel_location', {
    p_job_id: jobId,
    p_latitude: coordinates.latitude,
    p_longitude: coordinates.longitude,
    p_accuracy_meters: coordinates.accuracyMeters ?? 0,
    p_captured_at: coordinates.capturedAt,
  });
  if (error) throw error;
}

export async function stopServiceJobTravelSharing(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await client.rpc('stop_service_job_travel_sharing', {
    p_job_id: jobId,
  });
  if (error) throw error;
}

export function formatTravelDistanceTh(distanceKm: number | null) {
  if (distanceKm === null) return null;
  if (distanceKm < 1)
    return `ห่างประมาณ ${Math.max(1, Math.round(distanceKm * 1000))} เมตร`;
  return `ห่างประมาณ ${distanceKm.toLocaleString('th-TH', {
    maximumFractionDigits: 1,
  })} กม.`;
}

export function formatTravelEtaTh(estimatedMinutes: number | null) {
  if (estimatedMinutes === null) return null;
  if (estimatedMinutes <= 1) return 'ใกล้ถึงแล้ว';
  return `คาดว่าจะถึงในประมาณ ${estimatedMinutes.toLocaleString('th-TH')} นาที`;
}

export function formatTravelFreshnessTh(capturedAt: string | null) {
  if (!capturedAt) return null;
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(capturedAt).getTime()) / 1000),
  );
  if (seconds < 60) return 'อัปเดตตำแหน่งเมื่อสักครู่';
  return `อัปเดตตำแหน่ง ${Math.floor(seconds / 60).toLocaleString('th-TH')} นาทีที่แล้ว`;
}
