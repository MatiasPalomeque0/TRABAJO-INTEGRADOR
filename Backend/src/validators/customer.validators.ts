import { z } from 'zod';

export const customerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  documentNumber: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(190).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(250).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
}).strict();

export const customerUpdateSchema = customerSchema.partial();
export const customerStatusSchema = z.object({ isActive: z.boolean() }).strict();
