import type { RequestHandler } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { isReceptionist } from '../utils/techfix-permissions.js';

export const notifications: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, type, title, body, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  res.json({ data: rows });
});

export const markNotificationRead: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  await pool.execute('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  res.status(204).send();
});

export const stats: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  if (isReceptionist(req.user)) throw new AppError(403, 'RECEPTION_MODULE_PENDING', 'El módulo operativo de recepción se habilitará en la Fase 2.');
  const canSeeAll = req.user.roles.includes('admin');
  const repairScope = canSeeAll ? '' : req.user.roles.includes('tecnico') ? 'WHERE r.assigned_technician_id = ?' : 'WHERE d.owner_id = ?';
  const repairParams = canSeeAll ? [] : [req.user.id];
  const [repairRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS repairs, SUM(r.status = 'reparacion_finalizada') AS completedRepairs, SUM(r.status = 'esperando_aprobacion_presupuesto') AS pendingEstimates, SUM(r.status = 'listo_para_retirar') AS readyForPickup FROM repair_requests r JOIN devices d ON d.id = r.device_id ${repairScope}`, repairParams);
  const [deviceRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS devices FROM devices d ${canSeeAll ? '' : 'WHERE d.owner_id = ?'}`, canSeeAll ? [] : [req.user.id]);
  res.json({ data: { repairs: Number(repairRows[0].repairs ?? 0), completedRepairs: Number(repairRows[0].completedRepairs ?? 0), pendingEstimates: Number(repairRows[0].pendingEstimates ?? 0), readyForPickup: Number(repairRows[0].readyForPickup ?? 0), devices: Number(deviceRows[0].devices ?? 0) } });
});

export const auditLog: RequestHandler = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.metadata, a.created_at AS createdAt, a.actor_user_id AS actorUserId, CONCAT(u.first_name, ' ', u.last_name) AS actorName FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json({ data: rows });
});

