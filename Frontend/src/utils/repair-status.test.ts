import { describe, expect, it } from 'vitest';
import type { User } from '../types/api';
import { allowedRepairStatuses, isRepairClosed, normalizeRepairStatus, repairStatusLabel } from './repair-status';

const user = (roles: User['roles']): User => ({ id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', isActive: true, roles });

describe('estados de reparaciones en la interfaz', () => {
  it('muestra etiquetas legibles en español', () => {
    expect(repairStatusLabel('esperando_aprobacion_presupuesto')).toBe('Esperando aprobación de presupuesto');
    expect(repairStatusLabel('reparacion_finalizada')).toBe('Reparación finalizada');
  });

  it('limita las transiciones del técnico al flujo autorizado', () => {
    expect(allowedRepairStatuses('solicitud_recibida', user(['tecnico']))).toEqual(['pendiente_diagnostico', 'cancelado']);
    expect(allowedRepairStatuses('reparacion_finalizada', user(['tecnico']))).toEqual(['listo_para_retirar']);
    expect(allowedRepairStatuses('reparacion_finalizada', user(['tecnico']))).not.toContain('entregado');
  });

  it('limita al administrador al flujo presencial autorizado', () => {
    const next = allowedRepairStatuses('solicitud_recibida', user(['admin']));
    expect(next).toEqual(['pendiente_diagnostico', 'cancelado']);
    expect(allowedRepairStatuses('listo_para_retirar', user(['admin']))).toEqual([]);
  });

  it('no ofrece acciones técnicas a recepción', () => {
    expect(allowedRepairStatuses('solicitud_recibida', user(['recepcionista']))).toEqual([]);
  });

  it('oculta iniciar reparación si el presupuesto vigente sigue pendiente', () => {
    expect(allowedRepairStatuses('en_diagnostico', user(['admin']), { hasApprovedEstimate: false, hasPendingEstimate: true, hasAssignedTechnician: true })).not.toContain('en_reparacion');
    expect(allowedRepairStatuses('en_diagnostico', user(['admin']), { hasApprovedEstimate: true, hasPendingEstimate: false, hasAssignedTechnician: true })).toContain('en_reparacion');
  });

  it('no ofrece estado ni acciones técnicas para una orden entregada', () => {
    expect(isRepairClosed('entregado')).toBe(true);
    expect(isRepairClosed(' ENTREGADO ')).toBe(true);
    expect(normalizeRepairStatus(' ENTREGADO ')).toBe('entregado');
    expect(allowedRepairStatuses('entregado', user(['admin']))).toEqual([]);
    expect(allowedRepairStatuses('entregado', user(['tecnico']))).toEqual([]);
  });

  it('oculta finalizar hasta documentar el trabajo', () => {
    expect(allowedRepairStatuses('en_reparacion', user(['tecnico']), { hasWorkLogs: false })).not.toContain('reparacion_finalizada');
    expect(allowedRepairStatuses('en_reparacion', user(['tecnico']), { hasWorkLogs: true })).toContain('reparacion_finalizada');
  });
});
