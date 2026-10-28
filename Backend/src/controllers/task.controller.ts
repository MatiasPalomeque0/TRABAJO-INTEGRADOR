import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { taskSchema, taskPatchSchema, commentSchema, evidenceSchema } from '../validators/task.validators.js';
import * as tasks from '../repositories/task.repository.js';
import * as projects from '../repositories/project.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { audit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';
import type { TaskPriority, TaskStatus } from '../types/domain.js';

function currentUser(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  return req.user;
}

async function taskOr404(id: number) {
  const task = await tasks.findTask(id);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada.');
  return task;
}

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  res.json({ data: await tasks.listTasks(user.id, user.roles.includes('admin'), {
    search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
    projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    assigneeId: req.query.assigneeId ? Number(req.query.assigneeId) : undefined,
    status: typeof req.query.status === 'string' ? req.query.status as TaskStatus : undefined,
    priority: typeof req.query.priority === 'string' ? req.query.priority as TaskPriority : undefined,
    dueDate: typeof req.query.dueDate === 'string' ? req.query.dueDate : undefined
  }) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  if (!user.roles.includes('admin') && !(await projects.hasProjectAccess(task.projectId, user.id))) throw new AppError(403, 'FORBIDDEN', 'No tenés acceso a esta tarea.');
  res.json({ data: { ...task, comments: await tasks.listComments(task.id) } });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = taskSchema.parse(req.body);
  if (!user.roles.some((role) => role === 'admin' || role === 'coordinador') || (!user.roles.includes('admin') && !(await projects.canManageProject(input.projectId, user.id)))) throw new AppError(403, 'FORBIDDEN', 'No podés crear tareas en este proyecto.');
  if (input.assigneeId) {
    const assignee = await findUserById(input.assigneeId);
    if (!assignee?.isActive) throw new AppError(422, 'ASSIGNEE_INVALID', 'La persona asignada no está disponible.');
  }
  const task = await tasks.createTask(input);
  if (task.assigneeId && task.assigneeId !== user.id) await createNotification(task.assigneeId, 'task.assigned', 'Nueva tarea asignada', `Te asignaron «${task.title}» en ${task.projectName}.`);
  await audit(user.id, 'task.created', 'task', task.id);
  res.status(201).json({ data: task });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  const input = taskPatchSchema.parse(req.body);
  const canManage = user.roles.includes('admin') || await projects.canManageProject(task.projectId, user.id);
  if (!canManage) {
    if (task.assigneeId !== user.id || Object.keys(input).some((key) => key !== 'status')) throw new AppError(403, 'FORBIDDEN', 'Solo podés actualizar el estado de tus tareas.');
  }
  const updated = await tasks.updateTask(task.id, input);
  await audit(user.id, 'task.updated', 'task', task.id);
  res.json({ data: updated });
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  if (!user.roles.includes('admin') && !(await projects.canManageProject(task.projectId, user.id))) throw new AppError(403, 'FORBIDDEN', 'No podés eliminar esta tarea.');
  await tasks.deleteTask(task.id);
  await audit(user.id, 'task.deleted', 'task', task.id);
  res.status(204).send();
});

export const addComment: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  if (!user.roles.includes('admin') && !(await projects.hasProjectAccess(task.projectId, user.id))) throw new AppError(403, 'FORBIDDEN', 'No tenés acceso a esta tarea.');
  const created = await tasks.addComment(task.id, user.id, commentSchema.parse(req.body).body);
  if (task.assigneeId && task.assigneeId !== user.id) await createNotification(task.assigneeId, 'task.comment', 'Nuevo comentario', `${user.firstName} comentó en «${task.title}».`);
  res.status(201).json({ data: created });
});

export const addEvidence: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  if (!user.roles.includes('admin') && !(await projects.hasProjectAccess(task.projectId, user.id))) throw new AppError(403, 'FORBIDDEN', 'No tenés acceso a esta tarea.');
  res.status(201).json({ data: await tasks.addEvidence(task.id, user.id, evidenceSchema.parse(req.body)) });
});

export const listEvidence: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const task = await taskOr404(Number(req.params.id));
  if (!user.roles.includes('admin') && !(await projects.hasProjectAccess(task.projectId, user.id))) throw new AppError(403, 'FORBIDDEN', 'No tenés acceso a esta tarea.');
  res.json({ data: await tasks.listEvidence(task.id) });
});

