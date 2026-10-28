import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from '../src/validators/auth.validators.js';
import { taskSchema } from '../src/validators/task.validators.js';

describe('validaciones de API', () => {
  it('acepta registro fuerte y normaliza el correo', () => {
    const result = registerSchema.parse({ firstName: 'Ana', lastName: 'Pérez', email: ' ANA@EXAMPLE.COM ', password: 'Segura123', passwordConfirmation: 'Segura123' });
    expect(result.email).toBe('ana@example.com');
  });
  it('rechaza contraseñas débiles o confirmaciones distintas', () => {
    expect(() => registerSchema.parse({ firstName: 'A', lastName: 'B', email: 'no', password: 'abc', passwordConfirmation: 'def' })).toThrow();
  });
  it('rechaza login sin correo válido', () => {
    expect(() => loginSchema.parse({ email: 'invalid', password: 'x' })).toThrow();
  });
  it('valida estados y prioridades de tareas', () => {
    expect(taskSchema.parse({ projectId: 1, title: 'Entregar informe', priority: 'urgente' }).priority).toBe('urgente');
    expect(() => taskSchema.parse({ projectId: 1, title: 'x', priority: 'critical' })).toThrow();
  });
});

