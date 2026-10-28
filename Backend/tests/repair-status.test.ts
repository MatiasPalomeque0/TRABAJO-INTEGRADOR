import { describe, expect, it } from 'vitest';
import { canTransition } from '../src/utils/repair-status.js';

describe('transiciones de reparaciones TechFix', () => {
  it('permite al técnico iniciar el diagnóstico', () => {
    expect(canTransition('solicitud_recibida', 'pendiente_diagnostico', 'tecnico')).toBe(true);
  });

  it('impide al técnico entregar una reparación', () => {
    expect(canTransition('reparacion_finalizada', 'entregado', 'tecnico')).toBe(false);
  });

  it('permite al cliente cancelar una solicitud inicial', () => {
    expect(canTransition('solicitud_recibida', 'cancelado', 'cliente')).toBe(true);
    expect(canTransition('en_reparacion', 'cancelado', 'cliente')).toBe(false);
  });

  it('impide entregar sin registrar la entrega presencial', () => {
    expect(canTransition('reparacion_finalizada', 'entregado', 'admin')).toBe(false);
    expect(canTransition('listo_para_retirar', 'entregado', 'admin')).toBe(false);
  });
});
