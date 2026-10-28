import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { EmployeeRole } from '../validators/invitation.validators.js';

export interface EmployeeInvitationRecord {
  id: number;
  email: string;
  role: EmployeeRole;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  invitedBy: number;
  createdAt: string;
}

type InvitationRow = RowDataPacket & {
  id: number;
  email: string;
  role_slug: EmployeeRole;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  invited_by: number;
  created_at: string;
};

function mapInvitation(row: InvitationRow): EmployeeInvitationRecord {
  return { id: row.id, email: row.email, role: row.role_slug, tokenHash: row.token_hash, expiresAt: row.expires_at, usedAt: row.used_at, invitedBy: row.invited_by, createdAt: row.created_at };
}

export async function createInvitation(input: { email: string; role: EmployeeRole; tokenHash: string; expiresAt: Date; invitedBy: number }): Promise<EmployeeInvitationRecord> {
  const [roleRows] = await pool.query<RowDataPacket[]>('SELECT id FROM roles WHERE slug = ?', [input.role]);
  const roleId = roleRows[0]?.id;
  if (!roleId) throw new AppError(500, 'ROLE_NOT_CONFIGURED', 'El rol de empleado no está configurado en la base de datos.');

  const [activeRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM employee_invitations WHERE email = ? AND role_id = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
    [input.email, roleId]
  );
  if (activeRows.length) throw new AppError(409, 'INVITATION_ALREADY_EXISTS', 'Ya existe una invitación vigente para ese correo y rol.');

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO employee_invitations (email, role_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, ?, ?)',
      [input.email, roleId, input.tokenHash, input.expiresAt, input.invitedBy]
    );
    const [rows] = await pool.query<InvitationRow[]>(`
      SELECT ei.id, ei.email, r.slug AS role_slug, ei.token_hash, ei.expires_at, ei.used_at, ei.invited_by, ei.created_at
      FROM employee_invitations ei JOIN roles r ON r.id = ei.role_id WHERE ei.id = ?
    `, [result.insertId]);
    if (!rows[0]) throw new AppError(500, 'INVITATION_CREATE_FAILED', 'No se pudo recuperar la invitación creada.');
    return mapInvitation(rows[0]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'INVITATION_ALREADY_EXISTS', 'La invitación ya existe.');
    }
    throw error;
  }
}

export async function listInvitations(): Promise<Array<Omit<EmployeeInvitationRecord, 'tokenHash'>>> {
  const [rows] = await pool.query<InvitationRow[]>(`
    SELECT ei.id, ei.email, r.slug AS role_slug, ei.token_hash, ei.expires_at, ei.used_at, ei.invited_by, ei.created_at
    FROM employee_invitations ei JOIN roles r ON r.id = ei.role_id
    ORDER BY ei.created_at DESC LIMIT 100
  `);
  return rows.map((row) => {
    const invitation = mapInvitation(row);
    const { tokenHash: _tokenHash, ...publicInvitation } = invitation;
    return publicInvitation;
  });
}

type InvitationForUpdateRow = RowDataPacket & {
  id: number;
  email: string;
  role_slug: EmployeeRole;
  role_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  invited_by: number;
  created_at: string;
};

export async function findForUpdate(connection: PoolConnection, tokenHash: string): Promise<EmployeeInvitationRecord | null> {
  const [rows] = await connection.query<InvitationForUpdateRow[]>(`
    SELECT ei.id, ei.email, ei.role_id, r.slug AS role_slug, ei.token_hash, ei.expires_at, ei.used_at, ei.invited_by, ei.created_at
    FROM employee_invitations ei JOIN roles r ON r.id = ei.role_id
    WHERE ei.token_hash = ? FOR UPDATE
  `, [tokenHash]);
  return rows[0] ? mapInvitation(rows[0]) : null;
}

export async function findUserForUpdate(connection: PoolConnection, email: string): Promise<{ id: number; isActive: boolean } | null> {
  const [rows] = await connection.query<(RowDataPacket & { id: number; is_active: number })[]>('SELECT id, is_active FROM users WHERE email = ? FOR UPDATE', [email]);
  return rows[0] ? { id: Number(rows[0].id), isActive: Boolean(rows[0].is_active) } : null;
}

export async function createEmployeeUser(connection: PoolConnection, input: { email: string; firstName: string; lastName: string; passwordHash: string; role: EmployeeRole }): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
    [input.firstName, input.lastName, input.email, input.passwordHash]
  );
  await connection.execute('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = ?', [result.insertId, input.role]);
  return Number(result.insertId);
}

export async function addRole(connection: PoolConnection, userId: number, role: EmployeeRole): Promise<void> {
  await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = ?', [userId, role]);
}

export async function markUsed(connection: PoolConnection, invitationId: number): Promise<void> {
  await connection.execute('UPDATE employee_invitations SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [invitationId]);
}
