import { describe, expect, it } from 'vitest';
import type { User } from '../types/api';
import { canAssignRepair, canEditTechnicalRepair } from './repair-actions';

const user = (roles: User['roles']): User => ({ id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', isActive: true, roles });

describe('acciones del detalle de reparación', () => {
  it('oculta las mutaciones técnicas y la asignación cuando la orden está entregada', () => {
    expect(canEditTechnicalRepair(user(['admin']), 'entregado', true)).toBe(false);
    expect(canEditTechnicalRepair(user(['tecnico']), 'entregado', true)).toBe(false);
    expect(canAssignRepair(user(['admin']), 'entregado')).toBe(false);
  });

  it('mantiene las acciones legítimas en órdenes abiertas', () => {
    expect(canEditTechnicalRepair(user(['admin']), 'en_diagnostico', false)).toBe(true);
    expect(canEditTechnicalRepair(user(['tecnico']), 'en_diagnostico', true)).toBe(true);
    expect(canEditTechnicalRepair(user(['tecnico']), 'en_diagnostico', false)).toBe(false);
    expect(canEditTechnicalRepair(user(['recepcionista']), 'en_diagnostico', true)).toBe(false);
    expect(canAssignRepair(user(['admin']), 'en_diagnostico')).toBe(true);
    expect(canAssignRepair(user(['recepcionista']), 'en_diagnostico')).toBe(false);
  });
});
