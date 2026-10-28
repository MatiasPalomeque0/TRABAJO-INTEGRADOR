export type TechFixRole = 'admin' | 'recepcionista' | 'tecnico' | 'cliente';
export type DeviceType = 'desktop' | 'notebook' | 'all_in_one' | 'impresora' | 'otro';
export type RepairStatus = 'solicitud_recibida' | 'pendiente_diagnostico' | 'en_diagnostico' | 'esperando_aprobacion_presupuesto' | 'presupuesto_rechazado' | 'en_reparacion' | 'reparacion_finalizada' | 'listo_para_retirar' | 'entregado' | 'cancelado';
export type EstimateStatus = 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'rechazado' | 'vencido' | 'reemplazado';
export type EstimateDecision = 'aprobado' | 'rechazado';

export interface CustomerRecord { id: number; firstName: string; lastName: string; documentNumber: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; isActive: boolean; createdBy: number | null; createdAt: string; updatedAt: string; }
export interface DeviceRecord { id: number; ownerId: number | null; ownerName?: string | null; customerId: number | null; customerName?: string | null; deviceType: DeviceType; brand: string; model: string; serialNumber: string | null; description: string | null; createdAt: string; }
export interface RepairRecord { id: number; deviceId: number; deviceName: string; clientId: number | null; clientName: string; customerId: number | null; customerName: string | null; createdBy: number | null; technicianId: number | null; technicianName: string | null; problemDescription: string; status: RepairStatus; receivedAt: string; updatedAt: string; completedAt: string | null; }
export interface EstimateRecord { id: number; repairRequestId: number; createdBy: number; status: EstimateStatus; notes: string | null; laborCost: number; partsCost: number; total: number; createdAt: string; approvedAt: string | null; items?: EstimateItemRecord[]; }
export interface EstimateItemRecord { id: number; serviceId: number | null; description: string; quantity: number; unitPrice: number; subtotal: number; }
export interface EstimateDecisionRecord { id: number; estimateId: number; decision: EstimateDecision; decidedBy: number; decidedByName: string; channel: 'presencial'; observation: string | null; decidedAt: string; }
export interface RepairWorkLogRecord { id: number; repairRequestId: number; recordedBy: number; recordedByName: string; description: string; createdAt: string; }
export interface RepairDeliveryRecord { id: number; repairRequestId: number; deliveredBy: number; deliveredByName: string; pickedUpByName: string; deliveredAt: string; observations: string | null; idempotencyKey: string; items: Array<{ id: number; description: string; conditionAtIntake: string | null; returnStatus: 'pendiente' | 'devuelto' | 'no_corresponde'; returnedAt: string | null }>; }

