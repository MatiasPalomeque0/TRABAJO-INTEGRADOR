import { describe, expect, it } from 'vitest';
import { AppError } from '../src/utils/errors.js';
import { assertRepairOpen, isClosedRepairStatus } from '../src/utils/repair-lifecycle.js';

describe('cierre operativo de reparaciones', () => {
  it('considera entregado como estado cerrado', () => {
    expect(isClosedRepairStatus('entregado')).toBe(true);
    expect(isClosedRepairStatus('en_reparacion')).toBe(false);
  });

  it('rechaza mutaciones operativas sobre una orden entregada con 409 específico', () => {
    let error: unknown;
    try {
      assertRepairOpen('entregado');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(409);
    expect((error as AppError).code).toBe('REPAIR_CLOSED');
  });

  it('mantiene abiertas las órdenes que todavía no fueron entregadas', () => {
    expect(() => assertRepairOpen('listo_para_retirar')).not.toThrow();
    expect(() => assertRepairOpen('cancelado')).not.toThrow();
  });
});
