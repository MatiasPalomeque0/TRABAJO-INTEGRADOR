import { z } from 'zod';

export const intakeSchema = z.object({
  customerId: z.number().int().positive(),
  deviceId: z.number().int().positive(),
  problemDescription: z.string().trim().min(10).max(4000),
  equipmentCondition: z.string().trim().max(2000).nullable().optional(),
  observations: z.string().trim().max(4000).nullable().optional(),
  items: z.array(z.object({ description: z.string().trim().min(1).max(250), conditionAtIntake: z.string().trim().max(500).nullable().optional() }).strict()).max(50).default([])
}).strict();

export const idempotencyKeySchema = z.string().trim().min(16).max(100).regex(/^[A-Za-z0-9._~-]+$/, 'La clave de reintento no tiene un formato válido.');
