import { apiRequest } from './api';
import type { Notification, Role, Stats, User } from '../types/api';
export type EmployeeInvitation = { id: number; email: string; role: Extract<Role, 'recepcionista' | 'tecnico'>; expiresAt: string; token?: string; usedAt?: string | null; createdAt?: string };
export const miscApi = {
  stats: () => apiRequest<Stats>('/stats/overview'),
  notifications: () => apiRequest<Notification[]>('/notifications'),
  technicians: () => apiRequest<User[]>('/users/technicians'),
  markNotificationRead: (id: number) => apiRequest<null>(`/notifications/${id}/read`, { method: 'PATCH' }),
  users: (search?: string) => apiRequest<{ items: User[]; total: number }>(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateRoles: (id: number, roles: User['roles']) => apiRequest<User>(`/users/${id}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) }),
  updateStatus: (id: number, isActive: boolean) => apiRequest<User>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  createInvitation: (email: string, role: Extract<Role, 'recepcionista' | 'tecnico'>) => apiRequest<EmployeeInvitation>('/users/invitations', { method: 'POST', body: JSON.stringify({ email, role }) }),
  invitations: () => apiRequest<EmployeeInvitation[]>('/users/invitations')
};

