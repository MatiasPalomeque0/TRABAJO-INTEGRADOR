/** Roles vigentes de TechFix más los nombres heredados que usan los módulos antiguos. */
export type Role = 'admin' | 'recepcionista' | 'tecnico' | 'cliente' | 'coordinador' | 'usuario';
export type ProjectStatus = 'planificado' | 'en_progreso' | 'completado' | 'archivado';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
export type TaskPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Role[];
}

export interface UserRecord extends AuthUser {
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  ownerName: string;
  dueDate: string | null;
  status: ProjectStatus;
  createdAt: string;
  progress: number;
  memberCount: number;
}

export interface TaskRecord {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

