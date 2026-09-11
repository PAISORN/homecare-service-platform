export function qualityCasePath(caseId: string): `/cases/${string}` {
  return `/cases/${encodeURIComponent(caseId)}`;
}
