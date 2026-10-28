import type { AuthUser } from '../types/domain.js';

type RepairOwnership = { clientId: number | null; technicianId: number | null };

export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes('admin');
}

export function isTechnician(user: AuthUser): boolean {
  return !isAdmin(user) && user.roles.includes('tecnico');
}

export function isReceptionist(user: AuthUser): boolean {
  return !isAdmin(user) && !isTechnician(user) && user.roles.includes('recepcionista');
}

export function isClient(user: AuthUser): boolean {
  return !isAdmin(user) && !isTechnician(user) && !isReceptionist(user) && user.roles.includes('cliente');
}

export function canManageDevices(user: AuthUser): boolean {
  return isAdmin(user) || isClient(user);
}

export function canManageCommercialRecords(user: AuthUser): boolean {
  return isAdmin(user) || isReceptionist(user);
}

export function canCreateRepairs(user: AuthUser): boolean {
  return canManageDevices(user);
}

export function canAccessRepair(user: AuthUser, repair: RepairOwnership): boolean {
  if (isAdmin(user)) return true;
  if (isReceptionist(user)) return true;
  if (isTechnician(user)) return repair.technicianId === user.id;
  return isClient(user) && repair.clientId === user.id;
}

export function canChangeEstimateStatus(user: AuthUser): boolean {
  return isAdmin(user) || isReceptionist(user) || isClient(user);
}
