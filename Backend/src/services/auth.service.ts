import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { createRefreshToken, signAccessToken } from '../utils/jwt.js';
import { sha256 } from '../utils/crypto.js';
import { findUserByEmail, findUserById, createLocalUser, toAuthUser } from '../repositories/user.repository.js';
import type { AuthUser, UserRecord } from '../types/domain.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: UserRecord): Promise<AuthResponse> {
  const refresh = createRefreshToken();
  await pool.execute<ResultSetHeader>(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, refresh.hash, refresh.expiresAt]
  );
  return { user: toAuthUser(user), accessToken: signAccessToken(user.id), refreshToken: refresh.raw };
}

export async function register(input: { firstName: string; lastName: string; email: string; password: string }): Promise<AuthResponse> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await createLocalUser({ ...input, passwordHash });
  return issueTokens(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const [rows] = await pool.query<(RowDataPacket & { id: number; password_hash: string | null })[]>(
    'SELECT id, password_hash FROM users WHERE email = ?', [input.email]
  );
  if (!rows[0]?.password_hash || !(await bcrypt.compare(input.password, rows[0].password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }
  const user = await findUserById(rows[0].id);
  if (!user || !user.isActive) throw new AppError(401, 'ACCOUNT_DISABLED', 'La cuenta está deshabilitada.');
  return issueTokens(user);
}

export async function refresh(rawRefreshToken: string): Promise<AuthResponse> {
  const hash = sha256(rawRefreshToken);
  const [rows] = await pool.query<(RowDataPacket & { id: number; user_id: number; expires_at: string; revoked_at: string | null })[]>(
    'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?', [hash]
  );
  const current = rows[0];
  if (!current || current.revoked_at || new Date(current.expires_at).getTime() <= Date.now()) {
    throw new AppError(401, 'REFRESH_INVALID', 'La sesión de renovación no es válida.');
  }
  const user = await findUserById(current.user_id);
  if (!user || !user.isActive) throw new AppError(401, 'ACCOUNT_DISABLED', 'La cuenta está deshabilitada.');
  const next = createRefreshToken();
  const accessToken = signAccessToken(user.id);
  await withTransaction(async (connection) => {
    await connection.execute('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_hash = ? WHERE id = ?', [next.hash, current.id]);
    await connection.execute('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, next.hash, next.expiresAt]);
  });
  return { user: toAuthUser(user), accessToken, refreshToken: next.raw };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await pool.execute('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = ?', [sha256(rawRefreshToken)]);
}

