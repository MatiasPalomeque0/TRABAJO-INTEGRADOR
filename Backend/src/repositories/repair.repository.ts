import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { assertRepairOpen } from '../utils/repair-lifecycle.js';
import { canTransition } from '../utils/repair-status.js';
import { auditOnConnection } from '../services/audit.service.js';
import type { AuthUser } from '../types/domain.js';
import type { EstimateRecord, EstimateStatus, RepairRecord, RepairStatus } from '../types/techfix.js';

type RepairRow = RowDataPacket & { id: number; device_id: number; device_name: string; client_id: number | null; client_name: string; customer_id: number | null; customer_name: string | null; created_by: number | null; technician_id: number | null; technician_name: string | null; problem_description: string; status: RepairStatus; received_at: string; updated_at: string; completed_at: string | null };
function mapRepair(row: RepairRow): RepairRecord { return { id: row.id, deviceId: row.device_id, deviceName: row.device_name, clientId: row.client_id, clientName: row.client_name, customerId: row.customer_id, customerName: row.customer_name, createdBy: row.created_by, technicianId: row.technician_id, technicianName: row.technician_name, problemDescription: row.problem_description, status: row.status, receivedAt: row.received_at, updatedAt: row.updated_at, completedAt: row.completed_at }; }

const repairSelect = `SELECT r.id, r.device_id, CONCAT(d.brand, ' ', d.model) AS device_name, d.owner_id AS client_id, COALESCE(CONCAT(cu.first_name, ' ', cu.last_name), CONCAT(c.first_name, ' ', c.last_name), 'Cliente comercial') AS client_name, COALESCE(r.customer_id, d.customer_id) AS customer_id, CASE WHEN cu.id IS NULL THEN NULL ELSE CONCAT(cu.first_name, ' ', cu.last_name) END AS customer_name, r.created_by, r.assigned_technician_id AS technician_id, CASE WHEN t.id IS NULL THEN NULL ELSE CONCAT(t.first_name, ' ', t.last_name) END AS technician_name, r.problem_description, r.status, r.received_at, r.updated_at, r.completed_at FROM repair_requests r JOIN devices d ON d.id = r.device_id LEFT JOIN users c ON c.id = d.owner_id LEFT JOIN customers cu ON cu.id = COALESCE(r.customer_id, d.customer_id) LEFT JOIN users t ON t.id = r.assigned_technician_id`;

type RepairTransitionRole = 'admin' | 'tecnico' | 'cliente';
type LockedRepairRow = RowDataPacket & { id: number; status: RepairStatus; assigned_technician_id: number | null };

function assertExpectedRepairState(actual: RepairStatus, expected: RepairStatus): void {
  if (actual !== expected) {
    throw new AppError(409, 'STALE_REPAIR_STATE', 'La reparación cambió mientras se procesaba la solicitud. Actualizá la pantalla e intentá nuevamente.', { expectedStatus: expected, currentStatus: actual });
  }
}

function assertExpectedAssignment(actual: LockedRepairRow, expectedStatus?: RepairStatus, expectedTechnicianId?: number | null): void {
  if (expectedStatus !== undefined && actual.status !== expectedStatus) {
    throw new AppError(409, 'STALE_REPAIR_ASSIGNMENT', 'La reparación cambió mientras se asignaba el técnico. Actualizá la pantalla e intentá nuevamente.', { expectedStatus, currentStatus: actual.status, currentTechnicianId: actual.assigned_technician_id });
  }
  if (expectedTechnicianId !== undefined && (actual.assigned_technician_id ?? null) !== expectedTechnicianId) {
    throw new AppError(409, 'STALE_REPAIR_ASSIGNMENT', 'La reparación ya fue asignada o reasignada por otro administrador. Actualizá la pantalla e intentá nuevamente.', { expectedTechnicianId, currentTechnicianId: actual.assigned_technician_id });
  }
}

function assertTechnicalActor(actual: LockedRepairRow, actorId: number, actorRole?: 'admin' | 'tecnico'): void {
  if (actorRole === 'tecnico' && actual.assigned_technician_id !== actorId) {
    throw new AppError(403, 'FORBIDDEN', 'La reparación ya no está asignada al técnico autenticado.');
  }
}

async function hasPendingEstimateOnConnection(connection: import('mysql2/promise').PoolConnection, repairId: number): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>('SELECT id FROM estimates WHERE repair_request_id = ? AND status = \'pendiente_aprobacion\' LIMIT 1 FOR UPDATE', [repairId]);
  return rows.length > 0;
}

async function hasApprovedEstimateOnConnection(connection: import('mysql2/promise').PoolConnection, repairId: number): Promise<boolean> {
  const [rows] = await connection.query<(RowDataPacket & { status: EstimateStatus })[]>('SELECT status FROM estimates WHERE repair_request_id = ? AND status <> \'reemplazado\' ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE', [repairId]);
  return rows[0]?.status === 'aprobado';
}

async function hasWorkLogsOnConnection(connection: import('mysql2/promise').PoolConnection, repairId: number): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>('SELECT id FROM repair_work_logs WHERE repair_request_id = ? LIMIT 1 FOR UPDATE', [repairId]);
  return rows.length > 0;
}

async function isActiveTechnicianOnConnection(connection: import('mysql2/promise').PoolConnection, technicianId: number): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = ? AND u.is_active = 1 AND r.slug = 'tecnico' LIMIT 1 FOR UPDATE`, [technicianId]);
  return rows.length > 0;
}

export async function listRepairs(user: AuthUser, filters: { status?: RepairStatus; deviceId?: number; search?: string }): Promise<RepairRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (user.roles.includes('admin') || user.roles.includes('recepcionista')) { /* administration and reception see commercial orders */ }
  else if (user.roles.includes('tecnico')) { conditions.push('r.assigned_technician_id = ?'); params.push(user.id); }
  else { conditions.push('d.owner_id = ?'); params.push(user.id); }
  if (filters.status) { conditions.push('r.status = ?'); params.push(filters.status); }
  if (filters.deviceId) { conditions.push('r.device_id = ?'); params.push(filters.deviceId); }
  if (filters.search) { conditions.push('(r.problem_description LIKE ? OR d.brand LIKE ? OR d.model LIKE ? OR cu.first_name LIKE ? OR cu.last_name LIKE ?)'); params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`); }
  const [rows] = await pool.query<RepairRow[]>(`${repairSelect} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY r.updated_at DESC`, params);
  return rows.map(mapRepair);
}

export async function findRepair(id: number): Promise<RepairRecord | null> {
  const [rows] = await pool.query<RepairRow[]>(`${repairSelect} WHERE r.id = ?`, [id]);
  return rows[0] ? mapRepair(rows[0]) : null;
}

export async function createRepair(input: { deviceId: number; clientId: number; problemDescription: string }): Promise<RepairRecord> {
  const repairId = await withTransaction(async (connection) => {
    const [deviceRows] = await connection.query<RowDataPacket[]>('SELECT owner_id FROM devices WHERE id = ? FOR UPDATE', [input.deviceId]);
    if (!deviceRows[0]) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
    if (Number(deviceRows[0].owner_id) !== input.clientId) throw new AppError(403, 'FORBIDDEN', 'El equipo no pertenece al cliente.');
    const [result] = await connection.execute<ResultSetHeader>('INSERT INTO repair_requests (device_id, created_by, problem_description) VALUES (?, ?, ?)', [input.deviceId, input.clientId, input.problemDescription]);
    await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, NULL, ?, ?, ?)', [result.insertId, 'solicitud_recibida', input.clientId, 'Solicitud creada por el cliente.']);
    return Number(result.insertId);
  });
  const repair = await findRepair(repairId);
  if (!repair) throw new AppError(500, 'REPAIR_CREATE_FAILED', 'No se pudo recuperar la solicitud creada.');
  return repair;
}

export type PresentialIntakeItem = { description: string; conditionAtIntake?: string | null };
export type PresentialIntakeResult = { repairId: number; intakeId: number; wasDuplicate: boolean };

export async function createPresentialIntake(input: { customerId: number; deviceId: number; createdBy: number; problemDescription: string; equipmentCondition?: string | null; observations?: string | null; idempotencyKey?: string; items: PresentialIntakeItem[] }): Promise<PresentialIntakeResult> {
  return withTransaction(async (connection) => {
    if (input.idempotencyKey) {
      const [existingRows] = await connection.query<(RowDataPacket & { id: number; customer_id: number | null; device_id: number; problem_description: string })[]>('SELECT id, customer_id, device_id, problem_description FROM repair_requests WHERE intake_idempotency_key = ? FOR UPDATE', [input.idempotencyKey]);
      const existing = existingRows[0];
      if (existing) {
        if (Number(existing.customer_id) !== input.customerId || Number(existing.device_id) !== input.deviceId || existing.problem_description !== input.problemDescription) throw new AppError(409, 'INTAKE_KEY_CONFLICT', 'La clave de reintento ya fue utilizada con otros datos.');
        const [intakes] = await connection.query<RowDataPacket[]>('SELECT id FROM repair_intakes WHERE repair_request_id = ?', [existing.id]);
        if (!intakes[0]) throw new AppError(409, 'INTAKE_INCOMPLETE', 'La orden existente requiere revisión antes de reintentarse.');
        return { repairId: Number(existing.id), intakeId: Number(intakes[0].id), wasDuplicate: true };
      }
    }
    const [customerRows] = await connection.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND is_active = 1 FOR UPDATE', [input.customerId]);
    if (!customerRows[0]) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'El cliente no existe o está desactivado.');
    const [deviceRows] = await connection.query<(RowDataPacket & { customer_id: number | null })[]>('SELECT customer_id FROM devices WHERE id = ? FOR UPDATE', [input.deviceId]);
    if (!deviceRows[0]) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
    if (Number(deviceRows[0].customer_id) !== input.customerId) throw new AppError(409, 'DEVICE_CUSTOMER_MISMATCH', 'El equipo no está asociado al cliente seleccionado.');
    const [repairResult] = await connection.execute<ResultSetHeader>('INSERT INTO repair_requests (device_id, customer_id, created_by, intake_idempotency_key, problem_description) VALUES (?, ?, ?, ?, ?)', [input.deviceId, input.customerId, input.createdBy, input.idempotencyKey ?? null, input.problemDescription]);
    const repairId = Number(repairResult.insertId);
    await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, NULL, ?, ?, ?)', [repairId, 'solicitud_recibida', input.createdBy, 'Ingreso presencial registrado.']);
    const [intakeResult] = await connection.execute<ResultSetHeader>('INSERT INTO repair_intakes (repair_request_id, received_by, equipment_condition, observations) VALUES (?, ?, ?, ?)', [repairId, input.createdBy, input.equipmentCondition ?? null, input.observations ?? null]);
    const intakeId = Number(intakeResult.insertId);
    for (const item of input.items) await connection.execute('INSERT INTO repair_intake_items (repair_intake_id, description, condition_at_intake) VALUES (?, ?, ?)', [intakeId, item.description, item.conditionAtIntake ?? null]);
    return { repairId, intakeId, wasDuplicate: false };
  });
}

export async function findIntake(repairId: number): Promise<{ id: number; repairRequestId: number; receivedBy: number; receivedByName: string; receivedAt: string; equipmentCondition: string | null; observations: string | null; items: Array<{ id: number; description: string; conditionAtIntake: string | null; returnStatus: string; returnedAt: string | null }> } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT i.id, i.repair_request_id AS repairRequestId, i.received_by AS receivedBy, CONCAT(u.first_name, ' ', u.last_name) AS receivedByName, i.received_at AS receivedAt, i.equipment_condition AS equipmentCondition, i.observations FROM repair_intakes i JOIN users u ON u.id = i.received_by WHERE i.repair_request_id = ?`, [repairId]);
  if (!rows[0]) return null;
  const [items] = await pool.query<RowDataPacket[]>('SELECT id, description, condition_at_intake AS conditionAtIntake, return_status AS returnStatus, returned_at AS returnedAt FROM repair_intake_items WHERE repair_intake_id = ? ORDER BY created_at', [rows[0].id]);
  return { ...rows[0] as { id: number; repairRequestId: number; receivedBy: number; receivedByName: string; receivedAt: string; equipmentCondition: string | null; observations: string | null }, items: items as Array<{ id: number; description: string; conditionAtIntake: string | null; returnStatus: string; returnedAt: string | null }> };
}

export async function assignTechnician(input: { repairId: number; technicianId: number; actorId: number; expectedStatus?: RepairStatus; expectedTechnicianId?: number | null }): Promise<RepairRecord> {
  await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<LockedRepairRow[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    const current = repairRows[0];
    assertRepairOpen(current.status);
    assertExpectedAssignment(current, input.expectedStatus, input.expectedTechnicianId);

    const [technicians] = await connection.query<RowDataPacket[]>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = ? AND u.is_active = 1 AND r.slug = 'tecnico' LIMIT 1 FOR UPDATE`, [input.technicianId]);
    if (!technicians[0]) throw new AppError(404, 'TECHNICIAN_NOT_FOUND', 'El técnico no existe o no está habilitado.');
    const nextStatus: RepairStatus = current.status === 'solicitud_recibida' ? 'pendiente_diagnostico' : current.status;
    await connection.execute('UPDATE repair_requests SET assigned_technician_id = ?, status = ? WHERE id = ?', [input.technicianId, nextStatus, input.repairId]);
    await auditOnConnection(connection, input.actorId, 'repair.technician_assigned', 'repair_request', input.repairId, { technicianId: input.technicianId, previousTechnicianId: current.assigned_technician_id, previousStatus: current.status, nextStatus });
  });
  const repair = await findRepair(input.repairId);
  if (!repair) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
  return repair;
}

export async function isActiveTechnician(technicianId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = ? AND u.is_active = 1 AND r.slug = 'tecnico' LIMIT 1`, [technicianId]);
  return rows.length > 0;
}

export async function updateStatus(input: { repairId: number; actorId: number; role: RepairTransitionRole; status: RepairStatus; expectedStatus: RepairStatus; observation?: string | null }): Promise<RepairRecord> {
  await withTransaction(async (connection) => {
    const [rows] = await connection.query<LockedRepairRow[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!rows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    const current = rows[0];
    assertRepairOpen(current.status);
    assertExpectedRepairState(current.status, input.expectedStatus);
    assertTechnicalActor(current, input.actorId, input.role === 'tecnico' ? 'tecnico' : 'admin');
    if (input.status === 'entregado') throw new AppError(409, 'DELIVERY_REQUIRED_USE_ENDPOINT', 'La entrega debe registrarse desde el circuito presencial de entrega.');
    if (!canTransition(current.status, input.status, input.role)) throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'La transición de estado no está permitida para tu rol.');
    if (input.status === 'esperando_aprobacion_presupuesto' && !(await hasPendingEstimateOnConnection(connection, input.repairId))) throw new AppError(409, 'PENDING_ESTIMATE_REQUIRED', 'No se puede esperar una aprobación sin un presupuesto pendiente.');
    if (input.status === 'en_reparacion') {
      if (!current.assigned_technician_id) throw new AppError(409, 'TECHNICIAN_ASSIGNMENT_REQUIRED', 'Se necesita un técnico asignado para iniciar la reparación.');
      if (!(await isActiveTechnicianOnConnection(connection, current.assigned_technician_id))) throw new AppError(409, 'TECHNICIAN_NOT_ACTIVE', 'El técnico asignado no está activo o ya no tiene el rol técnico.');
      if (!(await hasApprovedEstimateOnConnection(connection, input.repairId))) throw new AppError(409, 'APPROVED_ESTIMATE_REQUIRED', 'No se puede iniciar la reparación sin un presupuesto aprobado.');
      if (await hasPendingEstimateOnConnection(connection, input.repairId)) throw new AppError(409, 'PENDING_ESTIMATE_EXISTS', 'No se puede iniciar la reparación mientras haya un presupuesto pendiente.');
    }
    if (input.status === 'reparacion_finalizada' && !(await hasWorkLogsOnConnection(connection, input.repairId))) throw new AppError(409, 'WORK_LOG_REQUIRED', 'Registrá al menos un trabajo realizado antes de finalizar la reparación.');
    await connection.execute('UPDATE repair_requests SET status = ?, completed_at = IF(? = \'reparacion_finalizada\', NOW(), completed_at) WHERE id = ?', [input.status, input.status, input.repairId]);
    await connection.execute('INSERT INTO repair_status_history (repair_request_id, previous_status, new_status, changed_by, observation) VALUES (?, ?, ?, ?, ?)', [input.repairId, current.status, input.status, input.actorId, input.observation ?? null]);
    await auditOnConnection(connection, input.actorId, 'repair.status_changed', 'repair_request', input.repairId, { previousStatus: current.status, status: input.status });
  });
  const repair = await findRepair(input.repairId);
  if (!repair) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
  return repair;
}

export async function addDiagnosis(input: { repairId: number; technicianId: number; actorRole?: 'admin' | 'tecnico'; description: string; recommendation?: string | null }): Promise<RowDataPacket> {
  const diagnosisId = await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<LockedRepairRow[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    assertTechnicalActor(repairRows[0], input.technicianId, input.actorRole);
    const [result] = await connection.execute<ResultSetHeader>('INSERT INTO diagnoses (repair_request_id, technician_id, description, recommendation) VALUES (?, ?, ?, ?)', [input.repairId, input.technicianId, input.description, input.recommendation ?? null]);
    await auditOnConnection(connection, input.technicianId, 'repair.diagnosis_added', 'diagnosis', Number(result.insertId), { repairId: input.repairId });
    return Number(result.insertId);
  });
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, repair_request_id AS repairId, technician_id AS technicianId, description, recommendation, created_at AS createdAt FROM diagnoses WHERE id = ?', [diagnosisId]);
  return rows[0];
}

export async function listDiagnoses(repairId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT d.id, d.repair_request_id AS repairId, d.technician_id AS technicianId, CONCAT(u.first_name, ' ', u.last_name) AS technicianName, d.description, d.recommendation, d.created_at AS createdAt FROM diagnoses d JOIN users u ON u.id = d.technician_id WHERE d.repair_request_id = ? ORDER BY d.created_at DESC`, [repairId]);
  return rows;
}

export async function listHistory(repairId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT h.id, h.previous_status AS previousStatus, h.new_status AS newStatus, h.observation, h.created_at AS createdAt, h.changed_by AS changedBy, CONCAT(u.first_name, ' ', u.last_name) AS changedByName FROM repair_status_history h JOIN users u ON u.id = h.changed_by WHERE h.repair_request_id = ? ORDER BY h.created_at ASC`, [repairId]);
  return rows;
}

export async function createEstimate(input: { repairId: number; createdBy: number; actorRole?: 'admin' | 'tecnico'; notes?: string | null; laborCost: number; partsCost: number; items: Array<{ serviceId?: number | null; description: string; quantity: number; unitPrice: number }> }): Promise<EstimateRecord> {
  const estimateId = await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<LockedRepairRow[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    assertTechnicalActor(repairRows[0], input.createdBy, input.actorRole);
    const [pendingRows] = await connection.query<(RowDataPacket & { id: number })[]>('SELECT id FROM estimates WHERE repair_request_id = ? AND status = \'pendiente_aprobacion\' ORDER BY created_at DESC, id DESC LIMIT 1', [input.repairId]);
    if (pendingRows[0]) throw new AppError(409, 'PENDING_ESTIMATE_EXISTS', 'Ya existe un presupuesto pendiente de aprobación para esta reparación.', { estimateId: Number(pendingRows[0].id) });
    const totalItems = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = input.laborCost + input.partsCost + totalItems;
    try {
      const [result] = await connection.execute<ResultSetHeader>('INSERT INTO estimates (repair_request_id, created_by, status, notes, labor_cost, parts_cost, total) VALUES (?, ?, \'pendiente_aprobacion\', ?, ?, ?, ?)', [input.repairId, input.createdBy, input.notes ?? null, input.laborCost, input.partsCost, total]);
      for (const item of input.items) await connection.execute('INSERT INTO estimate_items (estimate_id, service_id, description, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)', [result.insertId, item.serviceId ?? null, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]);
      await auditOnConnection(connection, input.createdBy, 'estimate.created', 'estimate', Number(result.insertId), { repairId: input.repairId });
      return Number(result.insertId);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'PENDING_ESTIMATE_EXISTS', 'Ya existe un presupuesto pendiente de aprobación para esta reparación.');
      throw error;
    }
  });
  const estimate = await findEstimate(estimateId);
  if (!estimate) throw new AppError(500, 'ESTIMATE_CREATE_FAILED', 'No se pudo recuperar el presupuesto creado.');
  return estimate;
}

export async function findEstimate(id: number): Promise<EstimateRecord | null> {
  const [rows] = await pool.query<(RowDataPacket & { id: number; repair_request_id: number; created_by: number; status: EstimateStatus; notes: string | null; labor_cost: number; parts_cost: number; total: number; created_at: string; approved_at: string | null })[]>('SELECT id, repair_request_id, created_by, status, notes, labor_cost, parts_cost, total, created_at, approved_at FROM estimates WHERE id = ?', [id]);
  if (!rows[0]) return null;
  const [items] = await pool.query<RowDataPacket[]>('SELECT id, service_id AS serviceId, description, quantity, unit_price AS unitPrice, subtotal FROM estimate_items WHERE estimate_id = ? ORDER BY id', [id]);
  const row = rows[0];
  return { id: row.id, repairRequestId: row.repair_request_id, createdBy: row.created_by, status: row.status, notes: row.notes, laborCost: Number(row.labor_cost), partsCost: Number(row.parts_cost), total: Number(row.total), createdAt: row.created_at, approvedAt: row.approved_at, items: items as EstimateRecord['items'] };
}

export async function listEstimates(repairId: number): Promise<EstimateRecord[]> {
  const [ids] = await pool.query<RowDataPacket[]>('SELECT id FROM estimates WHERE repair_request_id = ? ORDER BY created_at DESC, id DESC', [repairId]);
  const estimates: EstimateRecord[] = [];
  for (const row of ids) { const estimate = await findEstimate(Number(row.id)); if (estimate) estimates.push(estimate); }
  return estimates;
}

export async function hasPendingEstimate(repairId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM estimates WHERE repair_request_id = ? AND status = \'pendiente_aprobacion\' LIMIT 1', [repairId]);
  return rows.length > 0;
}

export async function hasApprovedEstimate(repairId: number): Promise<boolean> {
  const [rows] = await pool.query<(RowDataPacket & { status: EstimateStatus })[]>('SELECT status FROM estimates WHERE repair_request_id = ? AND status <> \'reemplazado\' ORDER BY created_at DESC, id DESC LIMIT 1', [repairId]);
  return rows[0]?.status === 'aprobado';
}

export async function updateEstimateStatus(id: number, repairId: number, status: EstimateStatus, actorUserId: number, metadata?: unknown): Promise<EstimateRecord> {
  await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<(RowDataPacket & { status: RepairStatus })[]>('SELECT status FROM repair_requests WHERE id = ? FOR UPDATE', [repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    const [rows] = await connection.query<(RowDataPacket & { status: EstimateStatus; repair_request_id: number })[]>('SELECT status, repair_request_id FROM estimates WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
    if (Number(rows[0].repair_request_id) !== repairId) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
    if (rows[0].status !== 'pendiente_aprobacion') throw new AppError(409, 'ESTIMATE_NOT_PENDING', 'Solo se puede decidir un presupuesto pendiente de aprobación.');
    try {
      await connection.execute('UPDATE estimates SET status = ?, approved_at = IF(? = \'aprobado\', NOW(), approved_at) WHERE id = ?', [status, status, id]);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (status === 'reemplazado' && (code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || code === 'WARN_DATA_TRUNCATED')) throw new AppError(409, 'ESTIMATE_REVIEW_MIGRATION_REQUIRED', 'La migración de revisión de presupuestos todavía no está aplicada.');
      throw error;
    }
      await auditOnConnection(connection, actorUserId, 'estimate.status_changed', 'estimate', id, metadata);
  });
  const estimate = await findEstimate(id);
  if (!estimate) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
  return estimate;
}

export async function replaceEstimate(id: number, repairId: number, actorUserId: number, metadata?: unknown): Promise<EstimateRecord> {
  await withTransaction(async (connection) => {
    const [repairRows] = await connection.query<(RowDataPacket & { status: RepairStatus })[]>('SELECT status FROM repair_requests WHERE id = ? FOR UPDATE', [repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    const [rows] = await connection.query<(RowDataPacket & { status: EstimateStatus; repair_request_id: number })[]>('SELECT status, repair_request_id FROM estimates WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
    if (Number(rows[0].repair_request_id) !== repairId) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
    if (rows[0].status !== 'pendiente_aprobacion') throw new AppError(409, 'ESTIMATE_NOT_PENDING', 'Solo se puede reemplazar un presupuesto pendiente de aprobación.');
    try {
      await connection.execute('UPDATE estimates SET status = \'reemplazado\' WHERE id = ?', [id]);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || code === 'WARN_DATA_TRUNCATED') throw new AppError(409, 'ESTIMATE_REVIEW_MIGRATION_REQUIRED', 'La migración de revisión de presupuestos todavía no está aplicada.');
      throw error;
    }
    await auditOnConnection(connection, actorUserId, 'estimate.status_changed', 'estimate', id, metadata);
  });
  const estimate = await findEstimate(id);
  if (!estimate) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
  return estimate;
}

export async function addPhoto(input: { repairId: number; uploadedBy: number; actorRole?: 'admin' | 'tecnico'; fileData: string; mimeType: string; description?: string | null }): Promise<RowDataPacket> {
  const storageKey = `repair/${input.repairId}/${Date.now()}.${input.mimeType.split('/')[1] ?? 'jpg'}`;
  return withTransaction(async (connection) => {
    const [repairRows] = await connection.query<LockedRepairRow[]>('SELECT id, status, assigned_technician_id FROM repair_requests WHERE id = ? FOR UPDATE', [input.repairId]);
    if (!repairRows[0]) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
    assertRepairOpen(repairRows[0].status);
    assertTechnicalActor(repairRows[0], input.uploadedBy, input.actorRole);
    const [result] = await connection.execute<ResultSetHeader>('INSERT INTO repair_photos (repair_request_id, uploaded_by, storage_key, file_data, mime_type, description) VALUES (?, ?, ?, ?, ?, ?)', [input.repairId, input.uploadedBy, storageKey, input.fileData, input.mimeType, input.description ?? null]);
    const [rows] = await connection.query<RowDataPacket[]>('SELECT id, repair_request_id AS repairId, uploaded_by AS uploadedBy, mime_type AS mimeType, description, created_at AS createdAt, storage_key AS storageKey FROM repair_photos WHERE id = ?', [result.insertId]);
    await auditOnConnection(connection, input.uploadedBy, 'repair.photo_added', 'repair_request', input.repairId, { photoId: Number(result.insertId) });
    return rows[0];
  });
}

export async function listPhotos(repairId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id, repair_request_id AS repairId, uploaded_by AS uploadedBy, mime_type AS mimeType, description, created_at AS createdAt, storage_key AS storageKey, (file_data IS NOT NULL) AS hasFile FROM repair_photos WHERE repair_request_id = ? ORDER BY created_at DESC', [repairId]);
  return rows;
}

