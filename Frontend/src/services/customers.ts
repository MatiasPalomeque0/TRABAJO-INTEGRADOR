import { apiRequest, query } from './api';
import type { Customer } from '../types/api';

export type CustomerInput = { firstName: string; lastName: string; documentNumber?: string | null; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null };

export const customerApi = {
  list: (search?: string, pageSize = 100) => apiRequest<{ items: Customer[]; total: number }>(`/customers${query({ search, pageSize })}`),
  get: (id: number) => apiRequest<Customer>(`/customers/${id}`),
  create: (body: CustomerInput) => apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<CustomerInput>) => apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateStatus: (id: number, isActive: boolean) => apiRequest<Customer>(`/customers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) })
};
