import { apiRequest, query } from './api';
import type { Estimate, Repair, RepairDelivery, RepairStatus, RepairWorkLog } from '../types/api';
export const repairApi = {
  list: (filters: { status?: RepairStatus; deviceId?: number; search?: string } = {}) => apiRequest<Repair[]>(`/repairs${query(filters)}`),
  get: (id: number) => apiRequest<Repair>(`/repairs/${id}`),
  create: (body: { deviceId: number; problemDescription: string }) => apiRequest<Repair>('/repairs', { method: 'POST', body: JSON.stringify(body) }),
  assign: (id: number, technicianId: number, expectedStatus?: RepairStatus, expectedTechnicianId?: number | null) => apiRequest<Repair>(`/repairs/${id}/assign`, { method: 'POST', body: JSON.stringify({ technicianId, expectedStatus, expectedTechnicianId }) }),
  updateStatus: (id: number, status: RepairStatus, expectedStatus?: RepairStatus, observation?: string) => apiRequest<Repair>(`/repairs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, expectedStatus, observation }) }),
  diagnosis: (id: number, body: { description: string; recommendation?: string | null }) => apiRequest(`/repairs/${id}/diagnosis`, { method: 'POST', body: JSON.stringify(body) }),
  createEstimate: (id: number, body: { notes?: string | null; laborCost: number; partsCost: number; items: { serviceId?: number | null; description: string; quantity: number; unitPrice: number }[] }) => apiRequest<Estimate>(`/repairs/${id}/estimates`, { method: 'POST', body: JSON.stringify(body) }),
  updateEstimateStatus: (repairId: number, estimateId: number, status: 'aprobado' | 'rechazado' | 'vencido' | 'reemplazado', observation?: string | null) => apiRequest<Estimate>(`/repairs/${repairId}/estimates/${estimateId}/status`, { method: 'PATCH', body: JSON.stringify({ status, observation }) }),
  presentialDecision: (repairId: number, estimateId: number, decision: 'aprobado' | 'rechazado', observation?: string | null) => apiRequest<Estimate>(`/repairs/${repairId}/estimates/${estimateId}/presential-decision`, { method: 'PATCH', body: JSON.stringify({ decision, observation }) }),
  addWorkLog: (id: number, description: string) => apiRequest<RepairWorkLog>(`/repairs/${id}/work-logs`, { method: 'POST', body: JSON.stringify({ description }) }),
  createDelivery: (id: number, body: { pickedUpByName: string; observations?: string | null; items: { id: number; returnStatus: 'devuelto' | 'no_corresponde' }[] }, key?: string) => apiRequest<{ repair: Repair; delivery: RepairDelivery }>(`/repairs/${id}/delivery`, { method: 'POST', headers: { 'Idempotency-Key': key ?? `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 12)}` }, body: JSON.stringify(body) }),
  getDelivery: (id: number) => apiRequest<RepairDelivery>(`/repairs/${id}/delivery`),
  photo: (id: number, body: { fileData: string; mimeType?: string; description?: string | null }) => apiRequest(`/repairs/${id}/photos`, { method: 'POST', body: JSON.stringify(body) })
};

