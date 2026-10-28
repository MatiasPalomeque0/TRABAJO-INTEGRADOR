import { describe, expect, it } from 'vitest';
import type { User } from '../types/api';
import { canCreateRepair, canManageCommercialRecords, canManageDevices, isReceptionist, isTechnician } from './permissions';

const user = (roles: User['roles']): User => ({ id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', isActive: true, roles });

describe('visibilidad de operaciones por rol', () => {
  it('muestra las operaciones de equipos y solicitudes al cliente', () => {
    const client = user(['cliente']);
    expect(canManageDevices(client)).toBe(true);
    expect(canCreateRepair(client)).toBe(true);
  });

  it('oculta las operaciones de equipos y nuevas solicitudes al técnico', () => {
    const technician = user(['tecnico']);
    expect(isTechnician(technician)).toBe(true);
    expect(canManageDevices(technician)).toBe(false);
    expect(canCreateRepair(technician)).toBe(false);
  });

  it('mantiene las operaciones administrativas', () => {
    const admin = user(['admin']);
    expect(canManageDevices(admin)).toBe(true);
    expect(canCreateRepair(admin)).toBe(true);
  });

  it('habilita el módulo comercial de recepción sin las acciones del cliente legado', () => {
    const receptionist = user(['recepcionista']);
    expect(isReceptionist(receptionist)).toBe(true);
    expect(canManageCommercialRecords(receptionist)).toBe(true);
    expect(canManageDevices(receptionist)).toBe(false);
    expect(canCreateRepair(receptionist)).toBe(false);
  });
});
