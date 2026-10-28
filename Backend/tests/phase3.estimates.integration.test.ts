import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app } from '../src/server.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_PHASE3_INTEGRATION === 'true' ? describe : describe.skip;

suite('Fase 3: un solo presupuesto pendiente por reparación', () => {
  const createdUserIds: number[] = [];
  const createdEstimateIds: number[] = [];
  let adminToken = '';
  let technicianToken = '';
  let receptionistToken = '';
  let technicianId = 0;
  let invitationId = 0;
  let clientId = 0;
  let clientToken = '';
  let deviceId = 0;
  let repairId = 0;

  beforeAll(async () => {
    const [admins] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'admin' ORDER BY u.id LIMIT 1`);
    const [technicians] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'tecnico' ORDER BY u.id LIMIT 1`);
    if (!admins[0] || !technicians[0]) throw new Error('La base de ensayo necesita un administrador y un técnico activos.');
    adminToken = signAccessToken(Number(admins[0].id));
    technicianId = Number(technicians[0].id);
    technicianToken = signAccessToken(technicianId);

    const invitation = await request(app).post('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`).send({ email: `phase3-reception-${Date.now()}@example.test`, role: 'recepcionista' });
    expect(invitation.status).toBe(201);
    invitationId = Number(invitation.body.data.id);
    const accepted = await request(app).post('/api/auth/employee-invitations/accept').send({ token: invitation.body.data.token, firstName: 'Recepción', lastName: 'Fase 3', password: 'Recepcion123', passwordConfirmation: 'Recepcion123' });
    expect(accepted.status).toBe(201);
    const receptionistId = Number(accepted.body.data.id);
    createdUserIds.push(receptionistId);
    receptionistToken = signAccessToken(receptionistId);

    const client = await request(app).post('/api/auth/register').send({ firstName: 'Cliente', lastName: 'Fase 3', email: `phase3-client-${Date.now()}@example.test`, password: 'Cliente123', passwordConfirmation: 'Cliente123' });
    expect(client.status).toBe(201);
    clientId = Number(client.body.data.user.id);
    createdUserIds.push(clientId);
    clientToken = client.body.data.accessToken;

    const device = await request(app).post('/api/devices').set('Authorization', `Bearer ${clientToken}`).send({ deviceType: 'notebook', brand: 'TechFix', model: 'Concurrencia', description: 'Fixture temporal de Fase 3' });
    expect(device.status).toBe(201);
    deviceId = Number(device.body.data.id);
    const repair = await request(app).post('/api/repairs').set('Authorization', `Bearer ${clientToken}`).send({ deviceId, problemDescription: 'Falla temporal para probar presupuestos concurrentes.' });
    expect(repair.status).toBe(201);
    repairId = Number(repair.body.data.id);
    const assignment = await request(app).post(`/api/repairs/${repairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId });
    expect(assignment.status).toBe(200);
  });

  it('responde 409 ante dos creaciones concurrentes y conserva una sola pendiente', async () => {
    const body = { notes: 'Prueba controlada de concurrencia', laborCost: 100, partsCost: 50, items: [] };
    const responses = await Promise.all([
      request(app).post(`/api/repairs/${repairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send(body),
      request(app).post(`/api/repairs/${repairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send(body)
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const created = responses.find((response) => response.status === 201);
    const createdEstimateId = Number(created?.body.data.id);
    createdEstimateIds.push(createdEstimateId);
    expect(created?.body.data.status).toBe('pendiente_aprobacion');
    const [rows] = await pool.query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM estimates WHERE repair_request_id = ? AND status = 'pendiente_aprobacion'`, [repairId]);
    expect(Number(rows[0].count)).toBe(1);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe('PENDING_ESTIMATE_EXISTS');
  });

  it('impide iniciar sin aprobación y evita que el técnico apruebe', async () => {
    const diagnosisTransition = await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_diagnostico' });
    expect(diagnosisTransition.status).toBe(200);
    const withoutApproval = await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' });
    expect(withoutApproval.status).toBe(409);
    expect(withoutApproval.body.error.code).toBe('APPROVED_ESTIMATE_REQUIRED');
    const technicianDecision = await request(app).patch(`/api/repairs/${repairId}/estimates/${createdEstimateIds[0]}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'aprobado' });
    expect(technicianDecision.status).toBe(403);
  });

  it('permite registrar decisiones presenciales y conserva presupuestos históricos', async () => {
    const receptionistDecision = await request(app).patch(`/api/repairs/${repairId}/estimates/${createdEstimateIds[0]}/status`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'aprobado' });
    expect(receptionistDecision.status).toBe(200);
    expect(receptionistDecision.body.data.status).toBe('aprobado');
    const second = await request(app).post(`/api/repairs/${repairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Versión histórica posterior', laborCost: 120, partsCost: 60, items: [] });
    expect(second.status).toBe(201);
    createdEstimateIds.push(Number(second.body.data.id));
    const replacement = await request(app).patch(`/api/repairs/${repairId}/estimates/${createdEstimateIds[1]}/status`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'reemplazado' });
    expect(replacement.status).toBe(200);
    expect(replacement.body.data.status).toBe('reemplazado');
    const third = await request(app).post(`/api/repairs/${repairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Presupuesto vigente de prueba', laborCost: 140, partsCost: 70, items: [] });
    expect(third.status).toBe(201);
    createdEstimateIds.push(Number(third.body.data.id));
    const detail = await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.estimates).toHaveLength(3);
    expect(detail.body.data.estimates.some((estimate: { status: string }) => estimate.status === 'aprobado')).toBe(true);
    expect(detail.body.data.estimates.some((estimate: { status: string }) => estimate.status === 'pendiente_aprobacion')).toBe(true);
    expect(detail.body.data.estimates.some((estimate: { status: string }) => estimate.status === 'reemplazado')).toBe(true);
    const [auditRows] = await pool.query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM audit_events WHERE action = 'estimate.status_changed' AND entity_type = 'estimate' AND entity_id = ?`, [createdEstimateIds[1]]);
    expect(Number(auditRows[0].count)).toBe(1);
  });

  afterAll(async () => {
    if (createdEstimateIds.length) {
      await pool.query('DELETE FROM estimate_items WHERE estimate_id IN (?)', [createdEstimateIds]);
      await pool.query('DELETE FROM estimate_decisions WHERE estimate_id IN (?)', [createdEstimateIds]);
      await pool.query('DELETE FROM estimates WHERE id IN (?)', [createdEstimateIds]);
    }
    if (repairId) await pool.execute('DELETE FROM repair_requests WHERE id = ?', [repairId]);
    if (deviceId) await pool.execute('DELETE FROM devices WHERE id = ?', [deviceId]);
    if (invitationId) await pool.execute('DELETE FROM employee_invitations WHERE id = ?', [invitationId]);
    if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
    await pool.end();
  });
});
