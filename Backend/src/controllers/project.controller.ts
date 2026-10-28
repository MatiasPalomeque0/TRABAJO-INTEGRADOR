import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { projectSchema, projectMemberSchema } from '../validators/project.validators.js';
import * as projects from '../repositories/project.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { audit } from '../services/audit.service.js';
import type { ProjectStatus } from '../types/domain.js';

function userId(req: Parameters<RequestHandler>[0]): number {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  return req.user.id;
}

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const current = userId(req);
  const canSeeAll = req.user?.roles.includes('admin') ?? false;
  const status = typeof req.query.status === 'string' ? req.query.status as ProjectStatus : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  res.json({ data: await projects.listProjects(current, canSeeAll, search, status) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projects.findProject(id);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
  if (!req.user?.roles.includes('admin') && !(await projects.hasProjectAccess(id, userId(req)))) throw new AppError(403, 'FORBIDDEN', 'No pertenecés a este proyecto.');
  res.json({ data: { ...project, members: await projects.listProjectMembers(id) } });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const current = userId(req);
  if (!req.user?.roles.some((role) => role === 'admin' || role === 'coordinador')) throw new AppError(403, 'FORBIDDEN', 'Solo un administrador o coordinador puede crear proyectos.');
  const project = await projects.createProject({ ...projectSchema.parse(req.body), ownerId: current });
  await audit(current, 'project.created', 'project', project.id);
  res.status(201).json({ data: project });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const canManage = req.user?.roles.includes('admin') || await projects.canManageProject(id, userId(req));
  if (!canManage) throw new AppError(403, 'FORBIDDEN', 'No podés modificar este proyecto.');
  const project = await projects.updateProject(id, projectSchema.partial().parse(req.body));
  await audit(userId(req), 'project.updated', 'project', id);
  res.json({ data: project });
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const canManage = req.user?.roles.includes('admin') || await projects.canManageProject(id, userId(req));
  if (!canManage) throw new AppError(403, 'FORBIDDEN', 'No podés archivar este proyecto.');
  await projects.archiveProject(id);
  await audit(userId(req), 'project.archived', 'project', id);
  res.status(204).send();
});

export const addMember: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const canManage = req.user?.roles.includes('admin') || await projects.canManageProject(id, userId(req));
  if (!canManage) throw new AppError(403, 'FORBIDDEN', 'No podés gestionar integrantes de este proyecto.');
  const input = projectMemberSchema.parse(req.body);
  const target = await findUserById(input.userId);
  if (!target || !target.isActive) throw new AppError(404, 'USER_NOT_FOUND', 'El integrante no existe o está deshabilitado.');
  await projects.addProjectMember(id, input.userId, input.role);
  await audit(userId(req), 'project.member_added', 'project', id, { userId: input.userId });
  res.status(204).send();
});

export const removeMember: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const canManage = req.user?.roles.includes('admin') || await projects.canManageProject(id, userId(req));
  if (!canManage) throw new AppError(403, 'FORBIDDEN', 'No podés gestionar integrantes de este proyecto.');
  await projects.removeProjectMember(id, Number(req.params.userId));
  res.status(204).send();
});

