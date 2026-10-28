import type { ReactNode } from 'react';
import { isRepairClosed } from '../utils/repair-status';

export function RepairOpenOnly({ status, children }: { status: string; children: ReactNode }) {
  return isRepairClosed(status) ? null : children;
}
