import type { RepairStatus, User } from '../types/api';

export const repairStatusLabels: Record<RepairStatus, string> = {
  solicitud_recibida: 'Solicitud recibida',
  pendiente_diagnostico: 'Pendiente de diagnóstico',
  en_diagnostico: 'En diagnóstico',
  esperando_aprobacion_presupuesto: 'Esperando aprobación de presupuesto',
  presupuesto_rechazado: 'Presupuesto rechazado',
  en_reparacion: 'En reparación',
  reparacion_finalizada: 'Reparación finalizada',
  listo_para_retirar: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

export const allRepairStatuses = Object.keys(repairStatusLabels) as RepairStatus[];

export function normalizeRepairStatus(status: RepairStatus | string): RepairStatus | string {
  return status.trim().toLowerCase();
}

export function isRepairClosed(status: RepairStatus | string): boolean {
  return normalizeRepairStatus(status) === 'entregado';
}

export type RepairStatusContext = { hasApprovedEstimate?: boolean; hasPendingEstimate?: boolean; hasAssignedTechnician?: boolean; hasWorkLogs?: boolean };

const technicianTransitions: Partial<Record<RepairStatus, RepairStatus[]>> = {
  solicitud_recibida: ['pendiente_diagnostico', 'cancelado'],
  pendiente_diagnostico: ['en_diagnostico', 'cancelado'],
  en_diagnostico: ['esperando_aprobacion_presupuesto', 'en_reparacion', 'cancelado'],
  presupuesto_rechazado: ['en_reparacion', 'cancelado'],
  esperando_aprobacion_presupuesto: ['en_reparacion', 'cancelado'],
  en_reparacion: ['reparacion_finalizada'],
  reparacion_finalizada: ['listo_para_retirar']
};

export function repairStatusLabel(status: RepairStatus | string): string {
  return repairStatusLabels[status as RepairStatus] ?? status.replaceAll('_', ' ');
}

export function allowedRepairStatuses(current: RepairStatus, user: User | null, context: RepairStatusContext = {}): RepairStatus[] {
  if (!user) return [];
  if (!(user.roles.includes('admin') || user.roles.includes('tecnico'))) return [];
  return (technicianTransitions[current] ?? []).filter((status) => {
    if (status === 'en_reparacion' && (context.hasApprovedEstimate !== true || context.hasPendingEstimate === true || context.hasAssignedTechnician === false)) return false;
    if (status === 'reparacion_finalizada' && context.hasWorkLogs === false) return false;
    return status !== 'entregado';
  });
}
