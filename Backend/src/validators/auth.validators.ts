import { z } from 'zod';

const password = z.string().min(8).max(72).regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[a-z]/, 'Debe incluir una minúscula').regex(/[0-9]/, 'Debe incluir un número');

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(190),
  password,
  passwordConfirmation: z.string()
}).refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'Las contraseñas no coinciden' });

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional()
}).strict();

