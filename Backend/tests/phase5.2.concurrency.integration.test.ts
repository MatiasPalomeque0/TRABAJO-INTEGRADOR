import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool, withTransaction } from '../src/config/db.js';
import { app } from '../src/server.js';
import { auditOnConnection } from '../src/services/audit.service.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_PHASE5_2_INTEGRATION === 'true' ? describe : describe.skip;

type Response = request.Response;

suite('Fase 5.2: concurrencia y consistencia transaccional', () => {
  const createdUserIds: number[] = [];
  const invitationIds: number[] = [];
  const customerIds: number[] = [];
  const deviceIds: number[] = [];
  const repairIds: number[] = [];
  const estimateIds: number[] = [];
  let adminId = 0;
  let adminToken = '';
  let technicianIds: number[] = [];
  let technicianTokens: string[] = [];
  let auditStartId = 0;
  let sequence = 0;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createSecondTechnicianIfNeeded(): Promise<void> {
    const [rows] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'tecnico' ORDER BY u.id LIMIT 2`);
    technicianIds = rows.map((row) => Number(row.id));
    if (technicianIds.length >= 2) {
      technicianTokens = technicianIds.map((id) => signAccessToken(id));
      return;
    }

    const email = `phase52-technician-${Date.now()}@example.test`;
    const invitation = await request(app).post('/api/users/invitations').set(auth(adminToken)).send({ email, role: 'tecnico' });
    expect(invitation.status).toBe(201);
    const invitationId = Number(invitation.body.data.id);
    invitationIds.push(invitationId);
    const accepted = await request(app).post('/api/auth/employee-invitations/accept').send({ token: invitation.body.data.token, firstName: 'Técnico', lastName: 'Concurrencia', password: 'Tecnico52A', passwordConfirmation: 'Tecnico52A' });
    expect(accepted.status).toBe(201);
    const createdTechnicianId = Number(accepted.body.data.id);
    createdUserIds.push(createdTechnicianId);
    technicianIds = [...technicianIds, createdTechnicianId];
    technicianTokens = technicianIds.map((id) => signAccessToken(id));
  }

  async function createRepair(label: string, items: Array<{ description: string; conditionAtIntake?: string }> = []): Promise<number> {
    sequence += 1;
    const suffix = `${Date.now()}-${sequence}`;
    const customer = await request(app).post('/api/customers').set(auth(adminToken)).send({ firstName: 'Cliente', lastName: `Fase 5.2 ${label}`, documentNumber: `F52-${suffix}`, phone: '1100000000' });
    expect(customer.status).toBe(201);
    const customerId = Number(customer.body.data.id);
    customerIds.push(customerId);

    const device = await request(app).post('/api/devices').set(auth(adminToken)).send({ customerId, deviceType: 'notebook', brand: 'TechFix', model: `Concurrencia ${label}`, description: 'Fixture temporal de concurrencia.' });
    expect(device.status).toBe(201);
    const deviceId = Number(device.body.data.id);
    deviceIds.push(deviceId);

    const intake = await request(app).post('/api/intakes').set(auth(adminToken)).set('Idempotency-Key', `phase52-intake-${suffix}`).send({ customerId, deviceId, problemDescription: `Orden temporal para prueba de concurrencia ${label}.`, items });
    expect(intake.status).toBe(201);
    const repairId = Number(intake.body.data.repair.id);
    repairIds.push(repairId);
    return repairId;
  }

  async function assignRepair(repairId: number, technicianId = technicianIds[0]): Promise<Response> {
    return request(app).post(`/api/repairs/${repairId}/assign`).set(auth(adminToken)).send({ technicianId });
  }

  async function moveToDiagnosis(repairId: number): Promise<void> {
    const response = await request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'en_diagnostico', expectedStatus: 'pendiente_diagnostico' });
    expect(response.status).toBe(200);
  }

  async function createPendingEstimate(repairId: number, token = technicianTokens[0]): Promise<number> {
    const response = await request(app).post(`/api/repairs/${repairId}/estimates`).set(auth(token)).send({ notes: 'Presupuesto temporal de concurrencia.', laborCost: 100, partsCost: 50, items: [] });
    expect(response.status).toBe(201);
    const estimateId = Number(response.body.data.id);
    estimateIds.push(estimateId);
    return estimateId;
  }

  async function prepareRepairForWork(label: string): Promise<number> {
    const repairId = await createRepair(label);
    expect((await assignRepair(repairId)).status).toBe(200);
    await moveToDiagnosis(repairId);
    const estimateId = await createPendingEstimate(repairId);
    expect((await request(app).patch(`/api/repairs/${repairId}/estimates/${estimateId}/presential-decision`).set(auth(adminToken)).send({ decision: 'aprobado', observation: 'Aprobación temporal para ensayo.' })).status).toBe(200);
    const start = await request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'en_reparacion', expectedStatus: 'en_diagnostico' });
    expect(start.status).toBe(200);
    return repairId;
  }

  async function prepareDeliveredRepair(label: string): Promise<number> {
    const repairId = await prepareRepairForWork(label);
    const initialWork = await request(app).post(`/api/repairs/${repairId}/work-logs`).set(auth(technicianTokens[0])).send({ description: 'Trabajo inicial necesario para cerrar el fixture temporal.' });
    expect(initialWork.status).toBe(201);
    const finished = await request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'reparacion_finalizada', expectedStatus: 'en_reparacion' });
    expect(finished.status).toBe(200);
    const ready = await request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'listo_para_retirar', expectedStatus: 'reparacion_finalizada' });
    expect(ready.status).toBe(200);
    const delivery = await request(app).post(`/api/repairs/${repairId}/delivery`).set(auth(adminToken)).set('Idempotency-Key', `phase52-delivery-${Date.now()}-${sequence}`).send({ pickedUpByName: 'Persona de ensayo', observations: 'Entrega temporal de prueba.', items: [] });
    expect(delivery.status).toBe(201);
    return repairId;
  }

  beforeAll(async () => {
    const [databaseRows] = await pool.query<Array<{ databaseName: string }>>('SELECT DATABASE() AS databaseName');
    expect(databaseRows[0].databaseName).toBe('techfix_phase2_20261028');
    const [migrations] = await pool.query<Array<{ version: string; checksum: string }>>('SELECT version, checksum FROM schema_migrations ORDER BY version');
    expect(migrations.map((migration) => migration.version)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008']);
    expect(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum))).toBe(true);

    const [admins] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'admin' ORDER BY u.id LIMIT 1`);
    if (!admins[0]) throw new Error('La base de ensayo necesita un administrador activo.');
    adminId = Number(admins[0].id);
    adminToken = signAccessToken(adminId);
    const [auditRows] = await pool.query<Array<{ id: number }>>('SELECT id FROM audit_events ORDER BY id DESC LIMIT 1');
    auditStartId = Number(auditRows[0]?.id ?? 0) + 1;
    await createSecondTechnicianIfNeeded();
  });

  it('resuelve asignaciones simultáneas y rechaza una precondición obsoleta', async () => {
    const repairId = await createRepair('asignación');
    const responses = await Promise.all(technicianIds.slice(0, 2).map((technicianId) => request(app).post(`/api/repairs/${repairId}/assign`).set(auth(adminToken)).send({ technicianId, expectedStatus: 'solicitud_recibida', expectedTechnicianId: null })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe('STALE_REPAIR_ASSIGNMENT');
    const stale = await request(app).post(`/api/repairs/${repairId}/assign`).set(auth(adminToken)).send({ technicianId: technicianIds[1], expectedStatus: 'solicitud_recibida', expectedTechnicianId: null });
    expect(stale.status).toBe(409);
    const detail = await request(app).get(`/api/repairs/${repairId}`).set(auth(adminToken));
    expect(detail.status).toBe(200);
    expect(technicianIds).toContain(Number(detail.body.data.technicianId));
    const [assignmentAuditRows] = await pool.query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM audit_events WHERE action = 'repair.technician_assigned' AND entity_type = 'repair_request' AND entity_id = ?`, [repairId]);
    expect(Number(assignmentAuditRows[0].count)).toBe(1);
  });

  it('resuelve transiciones simultáneas y no acepta estados obsoletos', async () => {
    const repairId = await createRepair('estado');
    expect((await assignRepair(repairId)).status).toBe(200);
    const responses = await Promise.all([
      request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'en_diagnostico', expectedStatus: 'pendiente_diagnostico' }),
      request(app).patch(`/api/repairs/${repairId}/status`).set(auth(technicianTokens[0])).send({ status: 'en_diagnostico', expectedStatus: 'pendiente_diagnostico' })
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe('STALE_REPAIR_STATE');
    const detail = await request(app).get(`/api/repairs/${repairId}`).set(auth(adminToken));
    expect(detail.body.data.status).toBe('en_diagnostico');
    expect(detail.body.data.history.filter((event: { newStatus: string }) => event.newStatus === 'en_diagnostico')).toHaveLength(1);
  });

  it('serializa decisiones contradictorias y creaciones concurrentes de presupuestos', async () => {
    const decisionRepairId = await createRepair('decisiones');
    expect((await assignRepair(decisionRepairId)).status).toBe(200);
    await moveToDiagnosis(decisionRepairId);
    const decisionEstimateId = await createPendingEstimate(decisionRepairId);
    const decisions = await Promise.all([
      request(app).patch(`/api/repairs/${decisionRepairId}/estimates/${decisionEstimateId}/presential-decision`).set(auth(adminToken)).send({ decision: 'aprobado', observation: 'Primera decisión simultánea.' }),
      request(app).patch(`/api/repairs/${decisionRepairId}/estimates/${decisionEstimateId}/presential-decision`).set(auth(adminToken)).send({ decision: 'rechazado', observation: 'Segunda decisión simultánea.' })
    ]);
    expect(decisions.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(decisions.find((response) => response.status === 409)?.body.error.code).toMatch(/ESTIMATE_(NOT_PENDING|DECISION_ALREADY_RECORDED)/);
    const decisionDetail = await request(app).get(`/api/repairs/${decisionRepairId}`).set(auth(adminToken));
    expect(decisionDetail.body.data.estimateDecisions).toHaveLength(1);

    const estimateRepairId = await createRepair('presupuestos');
    expect((await assignRepair(estimateRepairId)).status).toBe(200);
    await moveToDiagnosis(estimateRepairId);
    const estimates = await Promise.all([
      request(app).post(`/api/repairs/${estimateRepairId}/estimates`).set(auth(technicianTokens[0])).send({ notes: 'Carrera A', laborCost: 100, partsCost: 50, items: [] }),
      request(app).post(`/api/repairs/${estimateRepairId}/estimates`).set(auth(technicianTokens[0])).send({ notes: 'Carrera B', laborCost: 100, partsCost: 50, items: [] })
    ]);
    expect(estimates.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(estimates.find((response) => response.status === 409)?.body.error.code).toBe('PENDING_ESTIMATE_EXISTS');
    const created = estimates.find((response) => response.status === 201);
    estimateIds.push(Number(created?.body.data.id));
    const [pendingRows] = await pool.query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM estimates WHERE repair_request_id = ? AND status = 'pendiente_aprobacion'`, [estimateRepairId]);
    expect(Number(pendingRows[0].count)).toBe(1);
  });

  it('serializa trabajo frente a finalización y entregas simultáneas', async () => {
    const workRepairId = await prepareRepairForWork('trabajo');
    const initialWork = await request(app).post(`/api/repairs/${workRepairId}/work-logs`).set(auth(technicianTokens[0])).send({ description: 'Trabajo inicial antes de la carrera de finalización.' });
    expect(initialWork.status).toBe(201);
    const workRace = await Promise.all([
      request(app).patch(`/api/repairs/${workRepairId}/status`).set(auth(technicianTokens[0])).send({ status: 'reparacion_finalizada', expectedStatus: 'en_reparacion' }),
      request(app).post(`/api/repairs/${workRepairId}/work-logs`).set(auth(technicianTokens[0])).send({ description: 'Trabajo concurrente frente a la finalización.' })
    ]);
    expect(workRace.some((response) => response.status === 200)).toBe(true);
    expect(workRace.some((response) => response.status === 201 || response.status === 409)).toBe(true);
    const workDetail = await request(app).get(`/api/repairs/${workRepairId}`).set(auth(adminToken));
    expect(workDetail.body.data.status).toBe('reparacion_finalizada');
    expect(workDetail.body.data.workLogs.length).toBeGreaterThanOrEqual(1);

    const deliveryRepairId = await prepareRepairForWork('entregas');
    expect((await request(app).post(`/api/repairs/${deliveryRepairId}/work-logs`).set(auth(technicianTokens[0])).send({ description: 'Trabajo previo a la entrega concurrente.' })).status).toBe(201);
    expect((await request(app).patch(`/api/repairs/${deliveryRepairId}/status`).set(auth(technicianTokens[0])).send({ status: 'reparacion_finalizada', expectedStatus: 'en_reparacion' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${deliveryRepairId}/status`).set(auth(technicianTokens[0])).send({ status: 'listo_para_retirar', expectedStatus: 'reparacion_finalizada' })).status).toBe(200);
    const deliveries = await Promise.all([
      request(app).post(`/api/repairs/${deliveryRepairId}/delivery`).set(auth(adminToken)).set('Idempotency-Key', `phase52-race-a-${Date.now()}`).send({ pickedUpByName: 'Retira A', items: [] }),
      request(app).post(`/api/repairs/${deliveryRepairId}/delivery`).set(auth(adminToken)).set('Idempotency-Key', `phase52-race-b-${Date.now()}`).send({ pickedUpByName: 'Retira B', items: [] })
    ]);
    expect(deliveries.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(deliveries.find((response) => response.status === 409)?.body.error.code).toBe('DELIVERY_ALREADY_REGISTERED');
    const [deliveryRows] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM repair_deliveries WHERE repair_request_id = ?', [deliveryRepairId]);
    expect(Number(deliveryRows[0].count)).toBe(1);
  });

  it('revierte la operación si falla la auditoría dentro de la transacción', async () => {
    const documentNumber = `F52-ROLLBACK-${Date.now()}`;
    await expect(withTransaction(async (connection) => {
      const [result] = await connection.execute<{ insertId: number } & { affectedRows: number }>('INSERT INTO customers (first_name, last_name, document_number, created_by) VALUES (?, ?, ?, ?)', ['Rollback', 'Auditoría', documentNumber, adminId]);
      await auditOnConnection(connection, adminId, 'test.audit_failure', 'customer', Number(result.insertId), { unsupported: BigInt(1) });
    })).rejects.toThrow();
    const [rows] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM customers WHERE document_number = ?', [documentNumber]);
    expect(Number(rows[0].count)).toBe(0);
  });

  it('mantiene una reparación entregada en solo lectura bajo operaciones concurrentes', async () => {
    const repairId = await prepareDeliveredRepair('cerrada');
    const before = await request(app).get(`/api/repairs/${repairId}`).set(auth(adminToken));
    expect(before.status).toBe(200);
    const estimateId = Number(before.body.data.estimates[0].id);
    const responses = await Promise.all([
      request(app).post(`/api/repairs/${repairId}/diagnosis`).set(auth(technicianTokens[0])).send({ description: 'No debe persistir sobre orden cerrada.', recommendation: null }),
      request(app).post(`/api/repairs/${repairId}/estimates`).set(auth(technicianTokens[0])).send({ notes: 'No debe persistir', laborCost: 1, partsCost: 1, items: [] }),
      request(app).post(`/api/repairs/${repairId}/assign`).set(auth(adminToken)).send({ technicianId: technicianIds[1] }),
      request(app).post(`/api/repairs/${repairId}/work-logs`).set(auth(technicianTokens[0])).send({ description: 'No debe persistir trabajo posterior a entrega.' }),
      request(app).patch(`/api/repairs/${repairId}/status`).set(auth(adminToken)).send({ status: 'en_diagnostico' }),
      request(app).patch(`/api/repairs/${repairId}/estimates/${estimateId}/presential-decision`).set(auth(adminToken)).send({ decision: 'rechazado' }),
      request(app).post(`/api/repairs/${repairId}/photos`).set(auth(technicianTokens[0])).send({ fileData: 'x'.repeat(120), mimeType: 'image/jpeg' }),
      request(app).post(`/api/repairs/${repairId}/delivery`).set(auth(adminToken)).set('Idempotency-Key', `phase52-closed-${Date.now()}`).send({ pickedUpByName: 'Segundo intento', items: [] })
    ]);
    expect(responses.slice(0, 7).every((response) => response.status === 409)).toBe(true);
    expect(responses.slice(0, 7).every((response) => response.body.error.code === 'REPAIR_CLOSED')).toBe(true);
    expect(responses[7].status).toBe(409);
    const after = await request(app).get(`/api/repairs/${repairId}`).set(auth(adminToken));
    expect(after.body.data.status).toBe('entregado');
    expect(after.body.data.diagnoses).toHaveLength(before.body.data.diagnoses.length);
    expect(after.body.data.estimates).toHaveLength(before.body.data.estimates.length);
    expect(after.body.data.workLogs).toHaveLength(before.body.data.workLogs.length);
    expect(after.body.data.photos).toHaveLength(before.body.data.photos.length);
    expect(after.body.data.delivery).not.toBeNull();
  });

  afterAll(async () => {
    if (auditStartId) await pool.execute('DELETE FROM audit_events WHERE id >= ?', [auditStartId]);
    if (repairIds.length) await pool.query('DELETE FROM repair_deliveries WHERE repair_request_id IN (?)', [repairIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_decisions WHERE estimate_id IN (?)', [estimateIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_items WHERE estimate_id IN (?)', [estimateIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_photos WHERE repair_request_id IN (?)', [repairIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimates WHERE id IN (?)', [estimateIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_work_logs WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM diagnoses WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_status_history WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_requests WHERE id IN (?)', [repairIds]);
    if (deviceIds.length) await pool.query('DELETE FROM devices WHERE id IN (?)', [deviceIds]);
    if (customerIds.length) await pool.query('DELETE FROM customers WHERE id IN (?)', [customerIds]);
    if (invitationIds.length) await pool.query('DELETE FROM employee_invitations WHERE id IN (?)', [invitationIds]);
    if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
    await pool.end();
  });
});
