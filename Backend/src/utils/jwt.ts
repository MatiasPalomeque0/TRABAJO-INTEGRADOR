import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { randomToken, sha256 } from './crypto.js';
import type { Role } from '../types/domain.js';

export interface AccessClaims extends jwt.JwtPayload {
  sub: string;
  type: 'access';
}

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: String(userId), type: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return payload as AccessClaims;
}

export function createRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: sha256(raw), expiresAt };
}

export type RoleClaims = Role[];

