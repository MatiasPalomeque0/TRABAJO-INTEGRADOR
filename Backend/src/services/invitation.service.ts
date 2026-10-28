import bcrypt from 'bcryptjs';
import { withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { findUserById } from '../repositories/user.repository.js';
import * as invitations from '../repositories/invitation.repository.js';
import type { EmployeeRole } from '../validators/invitation.validators.js';

export async function createEmployeeInvitation(input: { email: string; role: EmployeeRole; expiresInHours: number; invitedBy: number }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
  const invitation = await invitations.createInvitation({ email: input.email, role: input.role, tokenHash: sha256(token), expiresAt, invitedBy: input.invitedBy });
  return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, token };
}

export async function listEmployeeInvitations() {
  return invitations.listInvitations();
}

export async function acceptEmployeeInvitation(input: { token: string; firstName: string; lastName: string; password?: string; passwordConfirmation?: string }) {
  const userId = await withTransaction(async (connection) => {
    const invitation = await invitations.findForUpdate(connection, sha256(input.token));
    if (!invitation) throw new AppError(404, 'INVITATION_NOT_FOUND', 'La invitación no existe o no es válida.');
    if (invitation.usedAt) throw new AppError(409, 'INVITATION_USED', 'La invitación ya fue utilizada.');
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) throw new AppError(410, 'INVITATION_EXPIRED', 'La invitación expiró.');

    const existingUser = await invitations.findUserForUpdate(connection, invitation.email);
    if (existingUser) {
      if (!existingUser.isActive) throw new AppError(409, 'ACCOUNT_DISABLED', 'La cuenta asociada está deshabilitada.');
      await invitations.addRole(connection, existingUser.id, invitation.role);
      await invitations.markUsed(connection, invitation.id);
      return existingUser.id;
    }

    if (!input.password) throw new AppError(422, 'EMPLOYEE_PASSWORD_REQUIRED', 'La contraseña es obligatoria para crear una cuenta de empleado.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const createdUserId = await invitations.createEmployeeUser(connection, { email: invitation.email, firstName: input.firstName, lastName: input.lastName, passwordHash, role: invitation.role });
    await invitations.markUsed(connection, invitation.id);
    return createdUserId;
  });

  const user = await findUserById(userId);
  if (!user) throw new AppError(500, 'EMPLOYEE_CREATE_FAILED', 'No se pudo recuperar el empleado autorizado.');
  return user;
}
