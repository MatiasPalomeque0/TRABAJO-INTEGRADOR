import type { Estimate, User } from '../types/api';

const estimateDecisionRoles: User['roles'] = ['admin', 'recepcionista', 'cliente'];

export function canCreateEstimate(pendingEstimateCount: number): boolean {
  return pendingEstimateCount === 0;
}

export function canRegisterEstimateDecision(user: User | null, estimate: Estimate | undefined, pendingEstimateCount: number): boolean {
  if (!estimate || estimate.status !== 'pendiente_aprobacion' || pendingEstimateCount !== 1) return false;
  return user?.roles.some((role) => estimateDecisionRoles.includes(role)) ?? false;
}

export function isPresentialDecisionRole(user: User | null): boolean {
  return user?.roles.includes('admin') || user?.roles.includes('recepcionista') || false;
}
