import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { TaskPriority, TaskRecord, TaskStatus } from '../types/domain.js';

type TaskRow = RowDataPacket & { id: number; project_id: number; project_name: string; title: string; description: string | null; assignee_id: number | null; assignee_name: string | null; status: TaskStatus; priority: TaskPriority; due_date: string | null; created_at: string; updated_at: string };

function mapTask(row: TaskRow): TaskRecord {
  return { id: row.id, projectId: row.project_id, projectName: row.project_name, title: row.title, description: row.description, assigneeId: row.assignee_id, assigneeName: row.assignee_name, status: row.status, priority: row.priority, dueDate: row.due_date, createdAt: row.created_at, updatedAt: row.updated_at };
}

const taskSelect = `SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description, t.assignee_id, CASE WHEN a.id IS NULL THEN NULL ELSE CONCAT(a.first_name, ' ', a.last_name) END AS assignee_name, t.status, t.priority, t.due_date, t.created_at, t.updated_at FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN users a ON a.id = t.assignee_id`;

export async function listTasks(userId: number, canSeeAll: boolean, filters: { search?: string; projectId?: number; assigneeId?: number; status?: TaskStatus; priority?: TaskPriority; dueDate?: string }): Promise<TaskRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!canSeeAll) { conditions.push('(p.owner_id = ? OR EXISTS (SELECT 1 FROM project_members pm_access WHERE pm_access.project_id = p.id AND pm_access.user_id = ?) OR t.assignee_id = ?)'); params.push(userId, userId, userId); }
  if (filters.search) { conditions.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${filters.search}%`, `%${filters.search}%`); }
  if (filters.projectId) { conditions.push('t.project_id = ?'); params.push(filters.projectId); }
  if (filters.assigneeId) { conditions.push('t.assignee_id = ?'); params.push(filters.assigneeId); }
  if (filters.status) { conditions.push('t.status = ?'); params.push(filters.status); }
  if (filters.priority) { conditions.push('t.priority = ?'); params.push(filters.priority); }
  if (filters.dueDate) { conditions.push('t.due_date = ?'); params.push(filters.dueDate); }
  const [rows] = await pool.query<TaskRow[]>(`${taskSelect} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY CASE t.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, t.due_date IS NULL, t.due_date`, params);
  return rows.map(mapTask);
}

export async function findTask(id: number): Promise<TaskRecord | null> {
  const [rows] = await pool.query<TaskRow[]>(`${taskSelect} WHERE t.id = ?`, [id]);
  return rows[0] ? mapTask(rows[0]) : null;
}

export async function createTask(input: { projectId: number; title: string; description?: string | null; assigneeId?: number | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }): Promise<TaskRecord> {
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)', [input.projectId, input.title, input.description ?? null, input.assigneeId ?? null, input.status ?? 'pendiente', input.priority ?? 'media', input.dueDate ?? null]);
  const task = await findTask(Number(result.insertId));
  if (!task) throw new AppError(500, 'TASK_CREATE_FAILED', 'No se pudo recuperar la tarea creada.');
  return task;
}

export async function updateTask(id: number, input: { title?: string; description?: string | null; assigneeId?: number | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }): Promise<TaskRecord> {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of [['title', 'title'], ['description', 'description'], ['assigneeId', 'assignee_id'], ['status', 'status'], ['priority', 'priority'], ['dueDate', 'due_date']] as const) {
    if (input[key] !== undefined) { fields.push(`${column} = ?`); values.push(input[key]); }
  }
  if (fields.length) await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, [...values, id] as Array<string | number | null>);
  const task = await findTask(id);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada.');
  return task;
}

export async function deleteTask(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM tasks WHERE id = ?', [id]);
  if (!result.affectedRows) throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada.');
}

export async function addComment(taskId: number, userId: number, body: string): Promise<RowDataPacket> {
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)', [taskId, userId, body]);
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT c.id, c.body, c.created_at AS createdAt, c.user_id AS userId, CONCAT(u.first_name, ' ', u.last_name) AS userName FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`, [result.insertId]);
  return rows[0];
}

export async function listComments(taskId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT c.id, c.body, c.created_at AS createdAt, c.user_id AS userId, CONCAT(u.first_name, ' ', u.last_name) AS userName FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.created_at ASC`, [taskId]);
  return rows;
}

export async function addEvidence(taskId: number, userId: number, input: { fileUrl?: string | null; fileData?: string | null; mimeType: string; latitude?: number | null; longitude?: number | null; note?: string | null }): Promise<RowDataPacket> {
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO task_evidence (task_id, user_id, file_url, file_data, mime_type, latitude, longitude, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [taskId, userId, input.fileUrl ?? null, input.fileData ?? null, input.mimeType, input.latitude ?? null, input.longitude ?? null, input.note ?? null]);
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, task_id AS taskId, user_id AS userId, file_url AS fileUrl, latitude, longitude, note, created_at AS createdAt FROM task_evidence WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function listEvidence(taskId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, task_id AS taskId, user_id AS userId, mime_type AS mimeType, latitude, longitude, note, created_at AS createdAt, (file_data IS NOT NULL OR file_url IS NOT NULL) AS hasFile FROM task_evidence WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
  return rows;
}

