import { z } from 'zod';

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  status: z.enum(['planificado', 'en_progreso', 'completado', 'archivado']).optional()
}).strict();

export const projectMemberSchema = z.object({ userId: z.number().int().positive(), role: z.enum(['miembro', 'responsable']).default('miembro') });

