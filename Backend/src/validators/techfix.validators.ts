import { z } from 'zod';

export const deviceSchema = z.object({
  deviceType: z.enum(['desktop', 'notebook', 'all_in_one', 'impresora', 'otro']),
  brand: z.string().trim().min(2).max(100),
  model: z.string().trim().min(1).max(160),
  serialNumber: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  customerId: z.number().int().positive().nullable().optional()
}).strict();

export const repairSchema = z.object({ deviceId: z.number().int().positive(), problemDescription: z.string().trim().min(10).max(4000) }).strict();
const repairStatusValue = z.enum(['solicitud_recibida', 'pendiente_diagnostico', 'en_diagnostico', 'esperando_aprobacion_presupuesto', 'presupuesto_rechazado', 'en_reparacion', 'reparacion_finalizada', 'listo_para_retirar', 'entregado', 'cancelado']);
export const repairStatusSchema = z.object({ status: repairStatusValue, expectedStatus: repairStatusValue.optional(), observation: z.string().trim().max(1000).nullable().optional() }).strict();
export const assignTechnicianSchema = z.object({ technicianId: z.number().int().positive(), expectedStatus: repairStatusValue.optional(), expectedTechnicianId: z.number().int().positive().nullable().optional() }).strict();
export const diagnosisSchema = z.object({ description: z.string().trim().min(10).max(4000), recommendation: z.string().trim().max(2000).nullable().optional() }).strict();
export const estimateSchema = z.object({ notes: z.string().trim().max(2000).nullable().optional(), laborCost: z.number().min(0).max(10_000_000), partsCost: z.number().min(0).max(10_000_000), items: z.array(z.object({ serviceId: z.number().int().positive().nullable().optional(), description: z.string().trim().min(1).max(500), quantity: z.number().positive().max(10_000), unitPrice: z.number().min(0).max(10_000_000) })).max(50) }).strict();
export const estimateStatusSchema = z.object({ status: z.enum(['aprobado', 'rechazado', 'vencido', 'reemplazado']), observation: z.string().trim().max(2000).nullable().optional() }).strict();
export const estimateDecisionSchema = z.object({ decision: z.enum(['aprobado', 'rechazado']), observation: z.string().trim().max(2000).nullable().optional() }).strict();
export const workLogSchema = z.object({ description: z.string().trim().min(10).max(4000) }).strict();
export const deliverySchema = z.object({ pickedUpByName: z.string().trim().min(2).max(160), observations: z.string().trim().max(2000).nullable().optional(), items: z.array(z.object({ id: z.number().int().positive(), returnStatus: z.enum(['devuelto', 'no_corresponde']) }).strict()).max(50).default([]) }).strict();
export const serviceSchema = z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).nullable().optional(), referencePrice: z.number().min(0).max(10_000_000), isActive: z.boolean().optional() }).strict();
export const repairPhotoSchema = z.object({ fileData: z.string().min(100).max(12_000_000), mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/).max(100).default('image/jpeg'), description: z.string().trim().max(500).nullable().optional() }).strict();

