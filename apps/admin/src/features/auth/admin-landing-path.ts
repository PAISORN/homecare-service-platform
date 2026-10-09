export type AdminPermission =
  'technician_review' | 'case_management' | 'operations_management';

export function getAdminLandingPath(
  permissions: readonly AdminPermission[],
): '/technicians' | '/cases' | '/operations' | '/unauthorized' {
  if (permissions.includes('technician_review')) return '/technicians';
  if (permissions.includes('case_management')) return '/cases';
  if (permissions.includes('operations_management')) return '/operations';
  return '/unauthorized';
}
