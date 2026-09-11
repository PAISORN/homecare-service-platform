export type AdminPermission = 'technician_review' | 'case_management';

export function getAdminLandingPath(
  permissions: readonly AdminPermission[],
): '/technicians' | '/cases' | '/unauthorized' {
  if (permissions.includes('technician_review')) return '/technicians';
  if (permissions.includes('case_management')) return '/cases';
  return '/unauthorized';
}
