import type { RequestHandler } from 'express';
import { findUserById, toAuthUser } from '../repositories/user.repository.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import type { Role } from '../types/domain.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
    const claims = verifyAccessToken(header.slice(7));
    const userId = Number(claims.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new AppError(401, 'TOKEN_INVALID', 'El token no es válido.');
    const user = await findUserById(userId);
    if (!user || !user.isActive) throw new AppError(401, 'ACCOUNT_DISABLED', 'La sesión no es válida.');
    req.user = toAuthUser(user);
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'TOKEN_INVALID', 'El token no es válido o expiró.'));
  }
};

export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.'));
    if (!allowedRoles.some((role) => req.user?.roles.includes(role))) return next(new AppError(403, 'FORBIDDEN', 'No tenés permisos para esta operación.'));
    next();
  };
}

