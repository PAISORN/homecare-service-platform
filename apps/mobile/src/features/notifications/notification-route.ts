const uuidPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const jobRoutePattern = new RegExp(
  `^/(jobs|technician/jobs)/(detail|chat|work)\\?jobId=(${uuidPattern})$`,
  'i',
);
const qualityRoutePattern = new RegExp(
  `^/(jobs|technician/jobs)/quality\\?jobId=(${uuidPattern})(?:&caseId=(${uuidPattern}))?$`,
  'i',
);

export type JobNotificationRoute =
  | `/${'jobs' | 'technician/jobs'}/${'detail' | 'chat' | 'work'}?jobId=${string}`
  | `/${'jobs' | 'technician/jobs'}/quality?jobId=${string}`
  | `/${'jobs' | 'technician/jobs'}/quality?jobId=${string}&caseId=${string}`;

export function parseJobNotificationRoute(
  value: unknown,
): JobNotificationRoute | null {
  if (
    typeof value !== 'string' ||
    (!jobRoutePattern.test(value) && !qualityRoutePattern.test(value))
  )
    return null;
  return value as JobNotificationRoute;
}
