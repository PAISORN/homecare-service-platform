import { describe, expect, it } from 'vitest';

import { parseJobNotificationRoute } from './notification-route';

const jobId = '550e8400-e29b-41d4-a716-446655440000';

describe('parseJobNotificationRoute', () => {
  it.each([
    `/jobs/detail?jobId=${jobId}`,
    `/jobs/chat?jobId=${jobId}`,
    `/jobs/work?jobId=${jobId}`,
    `/technician/jobs/detail?jobId=${jobId}`,
    `/technician/jobs/chat?jobId=${jobId}`,
    `/technician/jobs/work?jobId=${jobId}`,
    `/jobs/quality?jobId=${jobId}`,
    `/jobs/quality?jobId=${jobId}&caseId=${jobId}`,
    `/technician/jobs/quality?jobId=${jobId}&caseId=${jobId}`,
  ])('accepts an allowlisted service-job route: %s', (route) => {
    expect(parseJobNotificationRoute(route)).toBe(route);
  });

  it.each([
    'https://example.com/jobs/detail',
    '/account',
    `/jobs/detail?jobId=${jobId}&redirect=https://example.com`,
    `/jobs/quality?jobId=${jobId}&caseId=not-a-uuid`,
    '/jobs/detail?jobId=not-a-uuid',
    null,
  ])('rejects an untrusted notification route: %s', (route) => {
    expect(parseJobNotificationRoute(route)).toBeNull();
  });
});
