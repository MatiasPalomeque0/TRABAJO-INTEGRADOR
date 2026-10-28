import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { AuthUser, Role, UserRecord } from '../types/domain.js';

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  role_slugs: string | null;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    isActive: Boolean(row.is_active),
    roles: row.role_slugs ? row.role_slugs.split(',').filter(Boolean) as Role[] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const baseQuery = `
  SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.is_active, u.created_at, u.updated_at,
         GROUP_CONCAT(r.slug ORDER BY r.slug SEPARATOR ',') AS role_slugs
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

export async function findUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRow[]>(`${baseQuery} WHERE u.id = ? GROUP BY u.id`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRow[]>(`${baseQuery} WHERE u.email = ? GROUP BY u.id`, [email]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createLocalUser(input: { firstName: string; lastName: string; email: string; passwordHash: string }): Promise<UserRecord> {
  const id = await withTransaction(async (connection) => {
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
        [input.firstName, input.lastName, input.email, input.passwordHash]
      );
      await connection.execute('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = \'cliente\'', [result.insertId]);
      return Number(result.insertId);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'El correo ya está registrado.');
      }
      throw error;
    }
  });
  const user = await findUserById(id);
  if (!user) throw new AppError(500, 'USER_CREATE_FAILED', 'No se pudo recuperar el usuario creado.');
  return user;
}

export async function updateProfile(id: number, input: { firstName?: string; lastName?: string; avatarUrl?: string | null }): Promise<UserRecord> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.firstName !== undefined) { fields.push('first_name = ?'); values.push(input.firstName); }
  if (input.lastName !== undefined) { fields.push('last_name = ?'); values.push(input.lastName); }
  if (input.avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(input.avatarUrl); }
  if (fields.length) {
    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values as Array<string | number | null>);
  }
  const user = await findUserById(id);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
  return user;
}

export async function listUsers(search: string | undefined, page: number, pageSize: number): Promise<{ items: UserRecord[]; total: number }> {
  const term = search ? `%${search}%` : null;
  const where = term ? 'WHERE CONCAT(u.first_name, \' \', u.last_name) LIKE ? OR u.email LIKE ?' : '';
  const params = term ? [term, term] : [];
  const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
  const [rows] = await pool.query<UserRow[]>(`${baseQuery} ${where} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { items: rows.map(mapUser), total: Number(countRows[0].total) };
}

export async function listActiveTechnicians(): Promise<UserRecord[]> {
  const [rows] = await pool.query<UserRow[]>(`${baseQuery}
    WHERE u.is_active = 1
      AND EXISTS (
        SELECT 1
        FROM user_roles technician_user_role
        JOIN roles technician_role ON technician_role.id = technician_user_role.role_id
        WHERE technician_user_role.user_id = u.id AND technician_role.slug = 'tecnico'
      )
    GROUP BY u.id
    ORDER BY u.first_name, u.last_name`, []);
  return rows.map(mapUser);
}

export async function setUserStatus(actorId: number, targetId: number, isActive: boolean): Promise<UserRecord> {
  await withTransaction(async (connection) => {
    if (!isActive) {
      const [targetRoles] = await connection.query<RowDataPacket[]>(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.slug = 'admin'`, [targetId]
      );
      if (targetRoles.length) {
        const [activeAdmins] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS total FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.slug = 'admin' AND u.is_active = 1`, []
        );
        if (Number(activeAdmins[0].total) <= 1) throw new AppError(409, 'LAST_ADMIN', 'No se puede deshabilitar al último administrador activo.');
      }
    }
    await connection.execute('UPDATE users SET is_active = ? WHERE id = ?', [isActive, targetId]);
  });
  const user = await findUserById(targetId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
  return user;
}

export async function setUserRoles(targetId: number, roles: Role[]): Promise<UserRecord> {
  if (!roles.length) throw new AppError(422, 'ROLES_REQUIRED', 'El usuario debe conservar al menos un rol.');
  await withTransaction(async (connection) => {
    const [current] = await connection.query<RowDataPacket[]>(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.slug = 'admin'`, [targetId]
    );
    if (current.length && !roles.includes('admin')) {
      const [activeAdmins] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.slug = 'admin' AND u.is_active = 1`, []
      );
      if (Number(activeAdmins[0].total) <= 1) throw new AppError(409, 'LAST_ADMIN', 'No se puede quitar el rol del último administrador activo.');
    }
    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [targetId]);
    for (const role of roles) await connection.execute('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = ?', [targetId, role]);
  });
  const user = await findUserById(targetId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
  return user;
}

export function toAuthUser(user: UserRecord): AuthUser {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, roles: user.roles };
}

