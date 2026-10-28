export type Role = 'admin' | 'recepcionista' | 'tecnico' | 'cliente';
export type ThemeMode = 'system' | 'light' | 'dark';
export type ProjectStatus = 'planificado' | 'en_progreso' | 'completado' | 'archivado';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
export type TaskPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface User { id: number; email: string; firstName: string; lastName: string; isActive: boolean; roles: Role[]; avatarUrl?: string | null; }
export interface Customer { id: number; firstName: string; lastName: string; documentNumber: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; isActive: boolean; createdBy: number | null; createdAt: string; updatedAt: string; }
export interface Project { id: number; name: string; description: string | null; ownerId: number; ownerName: string; dueDate: string | null; status: ProjectStatus; createdAt: string; progress: number; memberCount: number; members?: { userId: number; name: string; email: string; role: string }[]; }
export interface Task { id: number; projectId: number; projectName: string; title: string; description: string | null; assigneeId: number | null; assigneeName: string | null; status: TaskStatus; priority: TaskPriority; dueDate: string | null; createdAt: string; updatedAt: string; comments?: Comment[]; }
export interface Comment { id: number; body: string; createdAt: string; userId: number; userName: string; }
export interface Notification { id: number; type: string; title: string; body: string; readAt: string | null; createdAt: string; }
export type DeviceType = 'desktop' | 'notebook' | 'all_in_one' | 'impresora' | 'otro';
export type RepairStatus = 'solicitud_recibida' | 'pendiente_diagnostico' | 'en_diagnostico' | 'esperando_aprobacion_presupuesto' | 'presupuesto_rechazado' | 'en_reparacion' | 'reparacion_finalizada' | 'listo_para_retirar' | 'entregado' | 'cancelado';
export type EstimateStatus = 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'rechazado' | 'vencido' | 'reemplazado';
export interface Device { id: number; ownerId: number | null; ownerName?: string | null; customerId: number | null; customerName?: string | null; deviceType: DeviceType; brand: string; model: string; serialNumber: string | null; description: string | null; createdAt: string; }
export interface IntakeItem { id: number; description: string; conditionAtIntake: string | null; returnStatus: string; returnedAt: string | null; }
export interface RepairIntake { id: number; repairRequestId: number; receivedBy: number; receivedByName: string; receivedAt: string; equipmentCondition: string | null; observations: string | null; items: IntakeItem[]; }
export interface Repair { id: number; deviceId: number; deviceName: string; clientId: number | null; clientName: string; customerId: number | null; customerName: string | null; createdBy: number | null; technicianId: number | null; technicianName: string | null; problemDescription: string; status: RepairStatus; receivedAt: string; updatedAt: string; completedAt: string | null; intake?: RepairIntake | null; history?: { id: number; previousStatus: string | null; newStatus: RepairStatus; observation: string | null; createdAt: string; changedByName: string }[]; diagnoses?: { id: number; description: string; recommendation: string | null; technicianName: string; createdAt: string }[]; estimates?: Estimate[]; estimateDecisions?: EstimateDecision[]; workLogs?: RepairWorkLog[]; delivery?: RepairDelivery | null; photos?: { id: number; mimeType: string; description: string | null; createdAt: string; hasFile: boolean }[]; }
export interface Estimate { id: number; repairRequestId: number; createdBy: number; status: EstimateStatus; notes: string | null; laborCost: number; partsCost: number; total: number; createdAt: string; approvedAt: string | null; items?: { id: number; serviceId: number | null; description: string; quantity: number; unitPrice: number; subtotal: number }[]; }
export interface EstimateDecision { id: number; estimateId: number; decision: 'aprobado' | 'rechazado'; decidedBy: number; decidedByName: string; channel: 'presencial'; observation: string | null; decidedAt: string; }
export interface RepairWorkLog { id: number; repairRequestId: number; recordedBy: number; recordedByName: string; description: string; createdAt: string; }
export interface RepairDelivery { id: number; repairRequestId: number; deliveredBy: number; deliveredByName: string; pickedUpByName: string; deliveredAt: string; observations: string | null; idempotencyKey: string; items: IntakeItem[]; }
export interface Service { id: number; name: string; description: string | null; referencePrice: number; isActive: boolean; createdAt: string; }
export interface Stats { repairs: number; completedRepairs: number; pendingEstimates: number; readyForPickup: number; devices: number; }
export interface AuthResponse { user: User; accessToken: string; refreshToken: string; }

