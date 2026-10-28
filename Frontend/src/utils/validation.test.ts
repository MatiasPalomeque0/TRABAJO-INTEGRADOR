import { describe, expect, it } from 'vitest';
import { loginFormSchema, registerFormSchema } from './validation';

describe('validaciones de formularios', () => {
  it('acepta login válido', () => expect(loginFormSchema.safeParse({ email: 'user@example.com', password: 'pass' }).success).toBe(true));
  it('requiere confirmación coincidente', () => expect(registerFormSchema.safeParse({ firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', password: 'Segura123', passwordConfirmation: 'Otra123' }).success).toBe(false));
});

