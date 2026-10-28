import { describe, expect, it } from 'vitest';
import { appRoutes } from './routes';
import { canManageCommercialRecords } from '../utils/permissions';
import type { User } from '../types/api';

function userWithRoles(...roles: User['roles']): User {
  return { id: 1, firstName: 'Prueba', lastName: 'Prueba', email: 'prueba@example.com', roles, isActive: true };
}

describe('rutas de recepción presencial', () => {
  it('mantiene destinos públicos estables para las pantallas anidadas', () => {
    expect(appRoutes.customers).toBe('/customers');
    expect(appRoutes.newCustomer).toBe('/customers/new');
    expect(appRoutes.newIntake).toBe('/intakes/new');
    expect(appRoutes.repairs).toBe('/repairs');
    expect(appRoutes.customerDetail(7)).toBe('/customers/7');
  });

  it('permite recepción a admin y recepcionista, pero no a técnico ni cliente legado', () => {
    expect(canManageCommercialRecords(userWithRoles('admin'))).toBe(true);
    expect(canManageCommercialRecords(userWithRoles('recepcionista'))).toBe(true);
    expect(canManageCommercialRecords(userWithRoles('tecnico'))).toBe(false);
    expect(canManageCommercialRecords(userWithRoles('cliente'))).toBe(false);
  });
});
