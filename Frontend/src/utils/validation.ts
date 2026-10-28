import { z } from 'zod';

export const loginFormSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const registerFormSchema = z.object({ firstName: z.string().trim().min(2), lastName: z.string().trim().min(2), email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/), passwordConfirmation: z.string() }).refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'] });

