import { describe, expect, it } from 'vitest';
import type { Estimate, User } from '../types/api';
import { canCreateEstimate, canRegisterEstimateDecision, isPresentialDecisionRole } from './estimate-visibility';

const user = (roles: User['roles']): User => ({ id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', isActive: true, roles });
const estimate: Estimate = { id: 2, repairRequestId: 2, createdBy: 2, status: 'pendiente_aprobacion', notes: null, laborCost: 25000, partsCost: 15000, total: 40000, createdAt: '2026-10-28T10:00:00.000Z', approvedAt: null };

describe('visibilidad del presupuesto vigente', () => {
  it('impide crear otro presupuesto mientras hay uno pendiente', () => {
    expect(canCreateEstimate(1)).toBe(false);
    expect(canCreateEstimate(0)).toBe(true);
  });

  it('permite la decisión presencial a admin y recepción, pero no a técnico', () => {
    expect(canRegisterEstimateDecision(user(['admin']), estimate, 1)).toBe(true);
    expect(canRegisterEstimateDecision(user(['recepcionista']), estimate, 1)).toBe(true);
    expect(canRegisterEstimateDecision(user(['tecnico']), estimate, 1)).toBe(false);
    expect(isPresentialDecisionRole(user(['recepcionista']))).toBe(true);
  });

  it('bloquea decidir si hay presupuestos pendientes duplicados', () => {
    expect(canRegisterEstimateDecision(user(['admin']), estimate, 2)).toBe(false);
  });
});
