import type { User } from '../types/api';

export function isAdmin(user: User | null): boolean {
  return user?.roles.includes('admin') ?? false;
}

export function isTechnician(user: User | null): boolean {
  return !isAdmin(user) && (user?.roles.includes('tecnico') ?? false);
}

export function isReceptionist(user: User | null): boolean {
  return !isAdmin(user) && !isTechnician(user) && (user?.roles.includes('recepcionista') ?? false);
}

export function isClient(user: User | null): boolean {
  return !isAdmin(user) && !isTechnician(user) && !isReceptionist(user) && (user?.roles.includes('cliente') ?? false);
}

export function canManageDevices(user: User | null): boolean {
  return isAdmin(user) || isClient(user);
}

export function canManageCommercialRecords(user: User | null): boolean {
  return isAdmin(user) || isReceptionist(user);
}

export function canCreateRepair(user: User | null): boolean {
  return canManageDevices(user);
}
