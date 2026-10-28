import { z } from 'zod';

export const taskSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  status: z.enum(['pendiente', 'en_progreso', 'completada', 'cancelada']).optional(),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  dueDate: z.string().date().nullable().optional()
}).strict();

export const taskPatchSchema = taskSchema.omit({ projectId: true }).partial().strict();

export const commentSchema = z.object({ body: z.string().trim().min(1).max(3000) });
export const evidenceSchema = z.object({ fileUrl: z.string().url().max(1000).nullable().optional(), fileData: z.string().max(12_000_000).nullable().optional(), mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/).max(100).default('image/jpeg'), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), note: z.string().trim().max(1000).nullable().optional() }).refine((value) => Boolean(value.fileUrl || value.fileData), { message: 'La evidencia debe incluir una imagen o URL.' });

