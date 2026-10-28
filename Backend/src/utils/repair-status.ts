import type { Role } from '../types/domain.js';
import type { RepairStatus } from '../types/techfix.js';

const technicianTransitions: Partial<Record<RepairStatus, RepairStatus[]>> = {
  solicitud_recibida: ['pendiente_diagnostico', 'cancelado'],
  pendiente_diagnostico: ['en_diagnostico', 'cancelado'],
  en_diagnostico: ['esperando_aprobacion_presupuesto', 'en_reparacion', 'cancelado'],
  esperando_aprobacion_presupuesto: ['en_reparacion', 'cancelado'],
  presupuesto_rechazado: ['en_reparacion', 'cancelado'],
  en_reparacion: ['reparacion_finalizada'],
  reparacion_finalizada: ['listo_para_retirar']
};

const adminTransitions: Partial<Record<RepairStatus, RepairStatus[]>> = technicianTransitions;

export function canTransition(current: RepairStatus, next: RepairStatus, role: Role): boolean {
  if (current === next) return true;
  if (role === 'admin') return adminTransitions[current]?.includes(next) ?? false;
  if (role === 'tecnico') return technicianTransitions[current]?.includes(next) ?? false;
  return current === 'solicitud_recibida' && next === 'cancelado';
}

