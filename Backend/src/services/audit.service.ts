import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/db.js';

const auditSql = 'INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)';

export async function auditOnConnection(connection: PoolConnection, actorUserId: number | null, action: string, entityType: string, entityId: number | null, metadata?: unknown): Promise<void> {
  await connection.execute(auditSql, [actorUserId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]);
}

export async function audit(actorUserId: number | null, action: string, entityType: string, entityId: number | null, metadata?: unknown): Promise<void> {
  await pool.execute(auditSql, [actorUserId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]);
}

