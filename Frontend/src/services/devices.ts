import { apiRequest, query } from './api';
import type { Device, DeviceType } from '../types/api';
export const deviceApi = {
  list: (search?: string, customerId?: number) => apiRequest<Device[]>(`/devices${query({ search, customerId })}`),
  get: (id: number) => apiRequest<Device>(`/devices/${id}`),
  create: (body: { deviceType: DeviceType; brand: string; model: string; serialNumber?: string | null; description?: string | null; customerId?: number | null }) => apiRequest<Device>('/devices', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ deviceType: DeviceType; brand: string; model: string; serialNumber: string | null; description: string | null }>) => apiRequest<Device>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: number) => apiRequest<null>(`/devices/${id}`, { method: 'DELETE' })
};

