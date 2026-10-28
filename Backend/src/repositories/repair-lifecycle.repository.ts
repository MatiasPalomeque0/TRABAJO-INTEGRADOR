import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import { auditOnConnection } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';
import { assertRepairOpen } from '../utils/repair-lifecycle.js';
import type { EstimateDecision, EstimateDecisionRecord, RepairDeliveryRecord, RepairWorkLogRecord } from '../types/techfix.js';

type DecisionInput = { repairId: number; estimateId: number; decidedBy: number; decision: EstimateDecision; observation?: string | null };
type DeliveryItemInput = { id: number; returnStatus: 'devuelto' | 'no_corresponde' };

export async function hasWorkLogs(repairId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM repair_work_logs WHERE repair_request_id = ? LIMIT 1', [repairId]);
  return rows.length > 0;
}

export async function listWorkLogs(repairId: number): Promise<RepairWorkLogRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT w.id, w.repair_request_id AS repairRequestId, w.recorded_by AS recordedBy,
    CONCAT(u.first_name, ' ', u.last_name) AS recordedByName, w.description, w.created_at AS createdAt
    FROM repair_work_logs w JOIN users u ON u.id = w.recorded_by
    WHERE w.repair_request_id = ? ORDER BY w.created_at ASC, w.id ASC`, [repairId]);
  return rows as RepairWorkLogRecord[];
}

export async function listEstimateDecisions(repairId: number): Promise<EstimateDecisionRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT d.id, d.estimate_id AS estimateId, d.decision, d.decided_by AS decidedBy,
    CONCAT(u.first_name, ' ', u.last_name) AS decidedByName, d.channel, d.observation, d.decided_at AS decidedAt
    FROM estimate_decisions d JOIN estimates e ON e.id = d.estimate_id JOIN users u ON u.id = d.decided_by
    WHERE e.repair_request_id = ? ORDER BY d.decided_at ASC, d.id ASC`, [repairId]);
  return rows as EstimateDecisionRecord[];
}

export async function recordPresentialDecision(input: DecisionInput): Promise<{ estimateId: number; decision: EstimateDecision; repairStatus: string }> {
  return withTransaction(async (connection) => {
    const [repairRows] = await connection.query<(RowDataPacket & { status: string })[]>('SELECT status FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    const [estimateRows] = await connection.query<(RowDataPacket & { id: number; status: string; repair_request_id: number })[]>(
      'SELECT id, status, repair_request_id FROM estimates WHERE id = ? FOR UPDATE', [input.estimateId]
    );
    const estimate = estimateRows[0];
    if (!estimate || Number(estimate.repair_request_id) !== input.repairId) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
    if (estimate.status !== 'pendiente_aprobacion') throw new AppError(409, 'ESTIMATE_NOT_PENDING', 'Solo se puede decidir un presupuesto pendiente de aprobación.');
    const allowedStatuses = ['en_diagnostico', 'esperando_aprobacion_presupuesto', 'presupuesto_rechazado'];
    if (!allowedStatuses.includes(repairRows[0].status)) throw new AppError(409, 'ESTIMATE_DECISION_REPAIR_STATE_INVALID', 'La reparación no está en un estado compatible con una decisión presencial.');

    try {
      await connection.execute('UPDATE estimates SET status = ?, approved_at = IF(? = \'aprobado\', NOW(), NULL) WHERE id = ?', [input.decision, input.decision, input.estimateId]);
      await connection.execute('INSERT INTO estimate_decisions (estimate_id, decision, decided_by, channel, observation) VALUES (?, ?, ?, \'presencial\', ?)', [input.estimateId, input.decision, input.decidedBy, input.observation ?? null]);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (code === 'ER_DUP_ENTRY') throw new AppError(409, 'ESTIMATE_DECISION_ALREADY_RECORDED', 'Este presupuesto ya tiene una decisión presencial registrada.');
      throw error;
    }

    let repairStatus = repairRows[0].status;
    if (input.decision === 'rechazado' && repairStatus !== 'presupuesto_rechazado') {
      await connection.execute('UPDATE repair_requests SET status = ? WHERE id = ?', ['presupuesto_rechazado', input.repairId]);
      await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, ?, ?, ?, ?)', [input.repairId, repairStatus, 'presupuesto_rechazado', input.decidedBy, input.observation ?? 'Presupuesto rechazado presencialmente.']);
      repairStatus = 'presupuesto_rechazado';
    } else if (input.decision === 'aprobado' && repairStatus === 'presupuesto_rechazado') {
      await connection.execute('UPDATE repair_requests SET status = ? WHERE id = ?', ['en_diagnostico', input.repairId]);
      await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, ?, ?, ?, ?)', [input.repairId, repairStatus, 'en_diagnostico', input.decidedBy, input.observation ?? 'Nuevo presupuesto aprobado presencialmente.']);
      repairStatus = 'en_diagnostico';
    }
    await auditOnConnection(connection, input.decidedBy, 'estimate.presential_decision', 'estimate', input.estimateId, { decision: input.decision, channel: 'presencial', observation: input.observation ?? null, repairId: input.repairId });
    return { estimateId: input.estimateId, decision: input.decision, repairStatus };
  });
}

export async function addWorkLog(input: { repairId: number; recordedBy: number; actorRole?: 'admin' | 'tecnico'; description: string }): Promise<RepairWorkLogRecord> {
  const id = await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<(RowDataPacket & { id: number; status: string; assigned_technician_id: number | null })[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    if (input.actorRole === 'tecnico' && repairRows[0].assigned_technician_id !== input.recordedBy) throw new AppError(403, 'FORBIDDEN', 'La reparación ya no está asignada al técnico autenticado.');
    if (repairRows[0].status !== 'en_reparacion') throw new AppError(409, 'WORK_LOG_REPAIR_STATE_INVALID', 'El trabajo solo puede documentarse mientras la reparación está en curso.');
    const [result] = await connection.execute<ResultSetHeader>('INSERT INTO repair_work_logs (repair_request_id, recorded_by, description) VALUES (?, ?, ?)', [input.repairId, input.recordedBy, input.description]);
    await auditOnConnection(connection, input.recordedBy, 'repair.work_logged', 'repair_request', input.repairId, { workLogId: result.insertId });
    return Number(result.insertId);
  });
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT w.id, w.repair_request_id AS repairRequestId, w.recorded_by AS recordedBy,
    CONCAT(u.first_name, ' ', u.last_name) AS recordedByName, w.description, w.created_at AS createdAt
    FROM repair_work_logs w JOIN users u ON u.id = w.recorded_by WHERE w.id = ?`, [id]);
  if (!rows[0]) throw new AppError(500, 'WORK_LOG_CREATE_FAILED', 'No se pudo recuperar el trabajo registrado.');
  return rows[0] as RepairWorkLogRecord;
}

export async function findDelivery(repairId: number): Promise<RepairDeliveryRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT d.id, d.repair_request_id AS repairRequestId, d.delivered_by AS deliveredBy,
    CONCAT(u.first_name, ' ', u.last_name) AS deliveredByName, d.picked_up_by_name AS pickedUpByName,
    d.delivered_at AS deliveredAt, d.observations, d.idempotency_key AS idempotencyKey
    FROM repair_deliveries d JOIN users u ON u.id = d.delivered_by WHERE d.repair_request_id = ?`, [repairId]);
  if (!rows[0]) return null;
  const [items] = await pool.query<RowDataPacket[]>(`SELECT ii.id, ii.description, ii.condition_at_intake AS conditionAtIntake,
    ii.return_status AS returnStatus, ii.returned_at AS returnedAt
    FROM repair_intakes i JOIN repair_intake_items ii ON ii.repair_intake_id = i.id
    WHERE i.repair_request_id = ? ORDER BY ii.id`, [repairId]);
  return { ...rows[0], items } as RepairDeliveryRecord;
}

export async function createDelivery(input: { repairId: number; deliveredBy: number; pickedUpByName: string; observations?: string | null; idempotencyKey: string; items: DeliveryItemInput[] }): Promise<{ delivery: RepairDeliveryRecord; wasDuplicate: boolean }> {
  const result = await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<(RowDataPacket & { status: string })[]>('SELECT status FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    const [existingRows] = await connection.query<(RowDataPacket & { id: number; idempotency_key: string })[]>('SELECT id, idempotency_key FROM repair_deliveries WHERE repair_request_id = ?', [input.repairId]);
    if (existingRows[0]) {
      if (existingRows[0].idempotency_key === input.idempotencyKey) return { id: Number(existingRows[0].id), wasDuplicate: true };
      throw new AppError(409, 'DELIVERY_ALREADY_REGISTERED', 'La entrega de esta reparación ya fue registrada.');
    }
    assertRepairOpen(repairRows[0].status);
    if (repairRows[0].status !== 'listo_para_retirar') throw new AppError(409, 'REPAIR_NOT_READY_FOR_DELIVERY', 'La reparación todavía no está lista para entregar.');
    const [intakeRows] = await connection.query<(RowDataPacket & { id: number })[]>('SELECT id FROM repair_intakes WHERE repair_request_id = ?', [input.repairId]);
    const intakeId = intakeRows[0]?.id;
    const [intakeItems] = intakeId ? await connection.query<(RowDataPacket & { id: number })[]>('SELECT id FROM repair_intake_items WHERE repair_intake_id = ? FOR UPDATE', [intakeId]) : [[] as (RowDataPacket & { id: number })[]];
    const expectedIds = new Set(intakeItems.map((item) => Number(item.id)));
    const suppliedIds = input.items.map((item) => item.id);
    if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((id) => !expectedIds.has(id)) || expectedIds.size !== suppliedIds.length) throw new AppError(422, 'DELIVERY_ITEMS_INVALID', 'Indicá el estado de devolución de todos los accesorios registrados.');
    for (const item of input.items) await connection.execute('UPDATE repair_intake_items SET return_status = ?, returned_at = IF(? = \'devuelto\', NOW(), NULL) WHERE id = ? AND repair_intake_id = ?', [item.returnStatus, item.returnStatus, item.id, intakeId ?? 0]);
    try {
      const [deliveryResult] = await connection.execute<ResultSetHeader>('INSERT INTO repair_deliveries (repair_request_id, delivered_by, picked_up_by_name, delivered_at, observations, idempotency_key) VALUES (?, ?, ?, NOW(), ?, ?)', [input.repairId, input.deliveredBy, input.pickedUpByName, input.observations ?? null, input.idempotencyKey]);
      await connection.execute('UPDATE repair_requests SET status = \'entregado\' WHERE id = ?', [input.repairId]);
      await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, ?, ?, ?, ?)', [input.repairId, 'listo_para_retirar', 'entregado', input.deliveredBy, input.observations ?? 'Entrega presencial registrada.']);
      await auditOnConnection(connection, input.deliveredBy, 'repair.delivered', 'repair_request', input.repairId, { deliveryId: deliveryResult.insertId, pickedUpByName: input.pickedUpByName, itemCount: input.items.length, channel: 'presencial' });
      return { id: Number(deliveryResult.insertId), wasDuplicate: false };
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (code === 'ER_DUP_ENTRY') throw new AppError(409, 'DELIVERY_ALREADY_REGISTERED', 'La entrega de esta reparación ya fue registrada.');
      throw error;
    }
  });
  const delivery = await findDelivery(input.repairId);
  if (!delivery) throw new AppError(500, 'DELIVERY_CREATE_FAILED', 'No se pudo recuperar la constancia de entrega.');
  return { delivery, wasDuplicate: result.wasDuplicate };
}
