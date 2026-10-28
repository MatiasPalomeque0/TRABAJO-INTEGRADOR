import { apiRequest, query } from './api';
import type { Comment, Task, TaskPriority, TaskStatus } from '../types/api';
export const taskApi = {
  list: (filters: { search?: string; projectId?: number; status?: TaskStatus; priority?: TaskPriority } = {}) => apiRequest<Task[]>(`/tasks${query(filters)}`),
  get: (id: number) => apiRequest<Task>(`/tasks/${id}`),
  create: (body: { projectId: number; title: string; description?: string | null; assigneeId?: number | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) => apiRequest<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ title: string; description: string | null; assigneeId: number | null; status: TaskStatus; priority: TaskPriority; dueDate: string | null }>) => apiRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: number) => apiRequest<null>(`/tasks/${id}`, { method: 'DELETE' }),
  comment: (id: number, body: string) => apiRequest<Comment>(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  evidence: (id: number, body: { fileData?: string; fileUrl?: string | null; mimeType?: string; latitude?: number | null; longitude?: number | null; note?: string | null }) => apiRequest(`/tasks/${id}/evidence`, { method: 'POST', body: JSON.stringify(body) }),
  evidenceList: (id: number) => apiRequest<{ id: number; hasFile: boolean; mimeType: string; latitude: number | null; longitude: number | null; note: string | null; createdAt: string }[]>(`/tasks/${id}/evidence`)
};

