import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { updateProfileSchema } from '../validators/auth.validators.js';
import { findUserById, listActiveTechnicians, listUsers, setUserRoles, setUserStatus, updateProfile } from '../repositories/user.repository.js';
import { audit } from '../services/audit.service.js';
import type { Role } from '../types/domain.js';

export const getUsers: RequestHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  res.json({ data: await listUsers(search, page, pageSize), meta: { page, pageSize } });
});

export const getTechnicians: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await listActiveTechnicians() });
});

export const getUser: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!req.user || (req.user.id !== id && !req.user.roles.includes('admin'))) throw new AppError(403, 'FORBIDDEN', 'No podés consultar este perfil.');
  const user = await findUserById(id);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
  res.json({ data: user });
});

export const updateUser: RequestHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!req.user || (req.user.id !== id && !req.user.roles.includes('admin'))) throw new AppError(403, 'FORBIDDEN', 'No podés modificar este perfil.');
  res.json({ data: await updateProfile(id, updateProfileSchema.parse(req.body)) });
});

export const updateRoles: RequestHandler = asyncHandler(async (req, res) => {
  const roles = req.body?.roles as Role[];
  if (!Array.isArray(roles) || roles.length === 0 || new Set(roles).size !== roles.length || roles.some((role) => !['admin', 'recepcionista', 'tecnico', 'cliente'].includes(role))) throw new AppError(422, 'ROLES_INVALID', 'Los roles enviados no son válidos.');
  const user = await setUserRoles(Number(req.params.id), roles);
  await audit(req.user?.id ?? null, 'user.roles_updated', 'user', user.id, { roles });
  res.json({ data: user });
});

export const updateStatus: RequestHandler = asyncHandler(async (req, res) => {
  if (typeof req.body?.isActive !== 'boolean') throw new AppError(422, 'STATUS_INVALID', 'isActive debe ser booleano.');
  const user = await setUserStatus(req.user?.id ?? 0, Number(req.params.id), req.body.isActive);
  await audit(req.user?.id ?? null, 'user.status_updated', 'user', user.id, { isActive: req.body.isActive });
  res.json({ data: user });
});
