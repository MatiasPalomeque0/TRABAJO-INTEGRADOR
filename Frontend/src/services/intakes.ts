import { apiRequest, query } from './api';
import type { Repair, RepairIntake } from '../types/api';

export type IntakeInput = { customerId: number; deviceId: number; problemDescription: string; equipmentCondition?: string | null; observations?: string | null; items: { description: string; conditionAtIntake?: string | null }[] };
export type IntakeResponse = { repair: Repair; intake: RepairIntake };

function idempotencyKey() { return `intake-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }

export const intakeApi = {
  list: (search?: string) => apiRequest<Repair[]>(`/intakes${query({ search })}`),
  get: (id: number) => apiRequest<IntakeResponse>(`/intakes/${id}`),
  create: (body: IntakeInput, key = idempotencyKey()) => apiRequest<IntakeResponse>('/intakes', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) })
};
