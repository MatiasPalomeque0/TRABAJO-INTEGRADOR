import { AppError } from './errors.js';
import type { RepairStatus } from '../types/techfix.js';

/**
 * Estados que cierran la orden para las mutaciones operativas ordinarias.
 * La reapertura no forma parte del alcance de esta fase.
 */
export const closedRepairStatuses: readonly RepairStatus[] = ['entregado'];

export function isClosedRepairStatus(status: string): status is RepairStatus {
  return closedRepairStatuses.includes(status as RepairStatus);
}

export function assertRepairOpen(status: string): void {
  if (isClosedRepairStatus(status)) {
    throw new AppError(409, 'REPAIR_CLOSED', 'La reparación está entregada y cerrada; no admite modificaciones operativas.');
  }
}
