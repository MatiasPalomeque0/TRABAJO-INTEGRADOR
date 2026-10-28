import { z } from 'zod';

const employeeRole = z.enum(['recepcionista', 'tecnico']);
const password = z.string().min(8).max(72).regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[a-z]/, 'Debe incluir una minúscula').regex(/[0-9]/, 'Debe incluir un número');

export const createEmployeeInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  role: employeeRole,
  expiresInHours: z.number().int().min(1).max(168).default(72)
}).strict();

export const acceptEmployeeInvitationSchema = z.object({
  token: z.string().trim().min(32).max(128),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  password: password.optional(),
  passwordConfirmation: z.string().optional()
}).strict().superRefine((value, context) => {
  if (value.password !== undefined && value.password !== value.passwordConfirmation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['passwordConfirmation'], message: 'Las contraseñas no coinciden' });
  }
});

export type EmployeeRole = z.infer<typeof employeeRole>;
