import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../src/types/domain.js';
import { canAccessRepair, canChangeEstimateStatus, canCreateRepairs, canManageDevices, isClient, isReceptionist, isTechnician } from '../src/utils/techfix-permissions.js';

const user = (id: number, roles: AuthUser['roles']): AuthUser => ({ id, email: `${id}@example.com`, firstName: 'Test', lastName: 'User', isActive: true, roles });
const assignedRepair = { clientId: 10, technicianId: 20 };

describe('permisos por rol de TechFix', () => {
  it('administrador conserva la gestión global', () => {
    const admin = user(1, ['admin']);
    expect(canManageDevices(admin)).toBe(true);
    expect(canCreateRepairs(admin)).toBe(true);
    expect(canAccessRepair(admin, assignedRepair)).toBe(true);
    expect(canChangeEstimateStatus(admin)).toBe(true);
  });

  it('cliente puede gestionar sus solicitudes, pero no recursos ajenos', () => {
    const client = user(10, ['cliente']);
    expect(canManageDevices(client)).toBe(true);
    expect(canCreateRepairs(client)).toBe(true);
    expect(canAccessRepair(client, assignedRepair)).toBe(true);
    expect(canAccessRepair(client, { clientId: 99, technicianId: 20 })).toBe(false);
    expect(canChangeEstimateStatus(client)).toBe(true);
  });

  it('técnico solo trabaja sobre reparaciones asignadas', () => {
    const technician = user(20, ['tecnico']);
    expect(isTechnician(technician)).toBe(true);
    expect(isClient(technician)).toBe(false);
    expect(canManageDevices(technician)).toBe(false);
    expect(canCreateRepairs(technician)).toBe(false);
    expect(canAccessRepair(technician, assignedRepair)).toBe(true);
    expect(canAccessRepair(technician, { clientId: 10, technicianId: 21 })).toBe(false);
    expect(canChangeEstimateStatus(technician)).toBe(false);
  });

  it('una cuenta con roles cliente y técnico no obtiene permisos de cliente', () => {
    const mixed = user(20, ['cliente', 'tecnico']);
    expect(canManageDevices(mixed)).toBe(false);
    expect(canCreateRepairs(mixed)).toBe(false);
    expect(canAccessRepair(mixed, assignedRepair)).toBe(true);
    expect(canAccessRepair(mixed, { clientId: 20, technicianId: 21 })).toBe(false);
  });

  it('recepción consulta órdenes pero no modifica módulos técnicos', () => {
    const receptionist = user(30, ['recepcionista']);
    expect(isReceptionist(receptionist)).toBe(true);
    expect(canManageDevices(receptionist)).toBe(false);
    expect(canCreateRepairs(receptionist)).toBe(false);
    expect(canAccessRepair(receptionist, assignedRepair)).toBe(true);
    expect(canChangeEstimateStatus(receptionist)).toBe(true);
  });
});
