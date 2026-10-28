import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { ProjectRecord, ProjectStatus } from '../types/domain.js';

type ProjectRow = RowDataPacket & {
  id: number; name: string; description: string | null; owner_id: number; owner_name: string;
  due_date: string | null; status: ProjectStatus; created_at: string; progress: number; member_count: number;
};

function mapProject(row: ProjectRow): ProjectRecord {
  return { id: row.id, name: row.name, description: row.description, ownerId: row.owner_id, ownerName: row.owner_name, dueDate: row.due_date, status: row.status, createdAt: row.created_at, progress: Number(row.progress ?? 0), memberCount: Number(row.member_count ?? 0) };
}

const projectSelect = `
  SELECT p.id, p.name, p.description, p.owner_id, CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
    p.due_date, p.status, p.created_at,
    COALESCE((SELECT ROUND(100 * SUM(CASE WHEN t2.status = 'completada' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) FROM tasks t2 WHERE t2.project_id = p.id), 0) AS progress,
    (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count
  FROM projects p
  JOIN users o ON o.id = p.owner_id
`;

function accessClause(userId: number, canSeeAll: boolean): { sql: string; params: unknown[] } {
  return canSeeAll
    ? { sql: '', params: [] }
    : { sql: 'WHERE (p.owner_id = ? OR EXISTS (SELECT 1 FROM project_members access_pm WHERE access_pm.project_id = p.id AND access_pm.user_id = ?))', params: [userId, userId] };
}

export async function listProjects(userId: number, canSeeAll: boolean, search?: string, status?: ProjectStatus): Promise<ProjectRecord[]> {
  const access = accessClause(userId, canSeeAll);
  const extra: string[] = [];
  const params = [...access.params];
  if (search) { extra.push('p.name LIKE ?'); params.push(`%${search}%`); }
  if (status) { extra.push('p.status = ?'); params.push(status); }
  const where = access.sql ? `${access.sql} ${extra.length ? 'AND' : ''}` : (extra.length ? 'WHERE' : '');
  const [rows] = await pool.query<ProjectRow[]>(`${projectSelect} ${where} ${extra.join(' AND ')} ORDER BY p.created_at DESC`, params);
  return rows.map(mapProject);
}

export async function findProject(id: number): Promise<ProjectRecord | null> {
  const [rows] = await pool.query<ProjectRow[]>(`${projectSelect} WHERE p.id = ?`, [id]);
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function hasProjectAccess(projectId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT 1 FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id IS NOT NULL) LIMIT 1`, [userId, projectId, userId]);
  return rows.length > 0;
}

export async function canManageProject(projectId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT 1 FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? AND pm.membership_role = 'responsable' WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id IS NOT NULL) LIMIT 1`, [userId, projectId, userId]);
  return rows.length > 0;
}

export async function createProject(input: { name: string; description?: string | null; ownerId: number; dueDate?: string | null; status?: ProjectStatus }): Promise<ProjectRecord> {
  const id = await withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>('INSERT INTO projects (name, description, owner_id, due_date, status) VALUES (?, ?, ?, ?, ?)', [input.name, input.description ?? null, input.ownerId, input.dueDate ?? null, input.status ?? 'planificado']);
    await connection.execute('INSERT INTO project_members (project_id, user_id, membership_role) VALUES (?, ?, \'responsable\')', [result.insertId, input.ownerId]);
    return Number(result.insertId);
  });
  const project = await findProject(id);
  if (!project) throw new AppError(500, 'PROJECT_CREATE_FAILED', 'No se pudo recuperar el proyecto creado.');
  return project;
}

export async function updateProject(id: number, input: { name?: string; description?: string | null; dueDate?: string | null; status?: ProjectStatus }): Promise<ProjectRecord> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.dueDate !== undefined) { fields.push('due_date = ?'); values.push(input.dueDate); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (fields.length) { await pool.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, [...values, id] as Array<string | number | null>); }
  const project = await findProject(id);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
  return project;
}

export async function archiveProject(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(`UPDATE projects SET status = 'archivado' WHERE id = ?`, [id]);
  if (!result.affectedRows) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
}

export async function addProjectMember(projectId: number, userId: number, role: 'miembro' | 'responsable'): Promise<void> {
  try {
    await pool.execute('INSERT INTO project_members (project_id, user_id, membership_role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE membership_role = VALUES(membership_role)', [projectId, userId, role]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_NO_REFERENCED_ROW_2') throw new AppError(404, 'USER_NOT_FOUND', 'Usuario o proyecto no encontrado.');
    throw error;
  }
}

export async function removeProjectMember(projectId: number, userId: number): Promise<void> {
  await pool.execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
}

export async function listProjectMembers(projectId: number): Promise<Array<{ userId: number; name: string; email: string; role: string }>> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT u.id AS user_id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.email, pm.membership_role AS role FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY name`, [projectId]);
  return rows as Array<{ userId: number; name: string; email: string; role: string }>;
}

