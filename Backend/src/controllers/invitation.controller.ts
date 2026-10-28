import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { acceptEmployeeInvitationSchema, createEmployeeInvitationSchema } from '../validators/invitation.validators.js';
import * as service from '../services/invitation.service.js';
import { audit } from '../services/audit.service.js';

export const create: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  const input = createEmployeeInvitationSchema.parse(req.body);
  const invitation = await service.createEmployeeInvitation({ ...input, invitedBy: req.user.id });
  await audit(req.user.id, 'employee_invitation.created', 'employee_invitation', invitation.id, { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt });
  res.status(201).json({ data: invitation });
});

export const list: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ data: await service.listEmployeeInvitations() });
});

export const accept: RequestHandler = asyncHandler(async (req, res) => {
  const user = await service.acceptEmployeeInvitation(acceptEmployeeInvitationSchema.parse(req.body));
  res.status(201).json({ data: user });
});
