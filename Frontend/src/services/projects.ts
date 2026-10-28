import { apiRequest, query } from './api';
import type { Project, ProjectStatus } from '../types/api';
export const projectApi = {
  list: (filters: { search?: string; status?: ProjectStatus } = {}) => apiRequest<Project[]>(`/projects${query(filters)}`),
  get: (id: number) => apiRequest<Project>(`/projects/${id}`),
  create: (body: { name: string; description?: string | null; dueDate?: string | null; status?: ProjectStatus }) => apiRequest<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ name: string; description: string | null; dueDate: string | null; status: ProjectStatus }>) => apiRequest<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archive: (id: number) => apiRequest<null>(`/projects/${id}`, { method: 'DELETE' }),
  addMember: (id: number, body: { userId: number; role: 'miembro' | 'responsable' }) => apiRequest<null>(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify(body) })
};

