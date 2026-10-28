import { describe, expect, it, vi } from 'vitest';
import type { RepairStatus } from '../types/api';
import { repairApi } from './repairs';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('./api', () => ({ apiRequest: mocks.apiRequest, query: (params: Record<string, unknown>) => Object.keys(params).length ? '?test=1' : '' }));

describe('precondiciones de concurrencia del cliente de reparaciones', () => {
  it('envía el estado y técnico observados al asignar', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ id: 7 });
    await repairApi.assign(7, 4, 'pendiente_diagnostico', 2);
    expect(mocks.apiRequest).toHaveBeenCalledWith('/repairs/7/assign', expect.objectContaining({ method: 'POST', body: JSON.stringify({ technicianId: 4, expectedStatus: 'pendiente_diagnostico', expectedTechnicianId: 2 }) }));
  });

  it('envía la precondición de estado al cambiar una reparación', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ id: 7 });
    await repairApi.updateStatus(7, 'en_reparacion' as RepairStatus, 'en_diagnostico', 'Inicio autorizado');
    expect(mocks.apiRequest).toHaveBeenCalledWith('/repairs/7/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'en_reparacion', expectedStatus: 'en_diagnostico', observation: 'Inicio autorizado' }) }));
  });
});
