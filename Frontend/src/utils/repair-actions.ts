import type { RepairStatus, User } from '../types/api';
import { isAdmin, isTechnician } from './permissions';
import { isRepairClosed } from './repair-status';

export function canEditTechnicalRepair(user: User | null, status: RepairStatus | string, assignedTechnician: boolean): boolean {
  if (isRepairClosed(status)) return false;
  return isAdmin(user) || (isTechnician(user) && assignedTechnician);
}

export function canAssignRepair(user: User | null, status: RepairStatus | string): boolean {
  return isAdmin(user) && !isRepairClosed(status);
}
