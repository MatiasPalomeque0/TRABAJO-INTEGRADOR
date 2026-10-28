import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app } from '../src/server.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_PHASE4_INTEGRATION === 'true' ? describe : describe.skip;

suite('Fase 4: decisiones presenciales, trabajo y entrega', () => {
  const createdUserIds: number[] = [];
  const estimateIds: number[] = [];
  const repairIds: number[] = [];
  const deviceIds: number[] = [];
  const invitationIds: number[] = [];
  const customerIds: number[] = [];
  let adminToken = '';
  let technicianToken = '';
  let receptionistToken = '';
  let technicianId = 0;
  let customerId = 0;
  let deviceId = 0;
  let repairId = 0;

  beforeAll(async () => {
    const [admins] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active=1 AND r.slug='admin' ORDER BY u.id LIMIT 1`);
    const [technicians] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active=1 AND r.slug='tecnico' ORDER BY u.id LIMIT 1`);
    if (!admins[0] || !technicians[0]) throw new Error('La base de ensayo necesita un administrador y un técnico activos.');
    adminToken = signAccessToken(Number(admins[0].id));
    technicianId = Number(technicians[0].id);
    technicianToken = signAccessToken(technicianId);

    const invitation = await request(app).post('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`).send({ email: `phase4-reception-${Date.now()}@example.test`, role: 'recepcionista' });
    expect(invitation.status).toBe(201);
    invitationIds.push(Number(invitation.body.data.id));
    const accepted = await request(app).post('/api/auth/employee-invitations/accept').send({ token: invitation.body.data.token, firstName: 'Recepción', lastName: 'Fase 4', password: 'Recepcion123', passwordConfirmation: 'Recepcion123' });
    expect(accepted.status).toBe(201);
    const receptionistId = Number(accepted.body.data.id);
    createdUserIds.push(receptionistId);
    receptionistToken = signAccessToken(receptionistId);

    const customer = await request(app).post('/api/customers').set('Authorization', `Bearer ${receptionistToken}`).send({ firstName: 'Cliente', lastName: 'Fase 4', documentNumber: `F4-${Date.now()}`, phone: '11223344' });
    expect(customer.status).toBe(201);
    customerId = Number(customer.body.data.id);
    customerIds.push(customerId);
    const device = await request(app).post('/api/devices').set('Authorization', `Bearer ${receptionistToken}`).send({ customerId, deviceType: 'notebook', brand: 'TechFix', model: 'Entrega Fase 4', description: 'Fixture controlado de Fase 4' });
    expect(device.status).toBe(201);
    deviceId = Number(device.body.data.id);
    deviceIds.push(deviceId);
    const intake = await request(app).post('/api/intakes').set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', `phase4-intake-${Date.now()}`).send({ customerId, deviceId, problemDescription: 'No inicia y requiere revisión presencial completa.', equipmentCondition: 'Sin golpes visibles.', observations: 'Fixture de integración.', items: [{ description: 'Cargador original', conditionAtIntake: 'Funciona' }] });
    expect(intake.status).toBe(201);
    repairId = Number(intake.body.data.repair.id);
    repairIds.push(repairId);
    expect((await request(app).post(`/api/repairs/${repairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId })).status).toBe(200);
  });

  it('registra aprobación presencial, trabajo, estados y entrega idempotente', async () => {
    expect((await request(app).get(`/api/repairs/${repairId}/delivery`)).status).toBe(401);
    expect((await request(app).patch(`/api/repairs/${repairId}/estimates/${999999}/presential-decision`).set('Authorization', `Bearer ${technicianToken}`).send({ decision: 'aprobado' })).status).toBe(403);
    expect((await request(app).post(`/api/repairs/${repairId}/diagnosis`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Se detectó falla en la alimentación del equipo.', recommendation: 'Reemplazar componente dañado.' })).status).toBe(201);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_diagnostico' })).status).toBe(200);
    const estimate = await request(app).post(`/api/repairs/${repairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Presupuesto presencial de prueba', laborCost: 25000, partsCost: 15000, items: [] });
    expect(estimate.status).toBe(201);
    const estimateId = Number(estimate.body.data.id);
    estimateIds.push(estimateId);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'esperando_aprobacion_presupuesto' })).status).toBe(200);
    const beforeApproval = await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' });
    expect(beforeApproval.status).toBe(409);
    expect(beforeApproval.body.error.code).toBe('APPROVED_ESTIMATE_REQUIRED');
    const approval = await request(app).patch(`/api/repairs/${repairId}/estimates/${estimateId}/presential-decision`).set('Authorization', `Bearer ${receptionistToken}`).send({ decision: 'aprobado', observation: 'Cliente acepta presencialmente el importe informado.' });
    expect(approval.status).toBe(200);
    expect(approval.body.meta.channel).toBe('presencial');
    expect((await request(app).patch(`/api/repairs/${repairId}/estimates/${estimateId}/presential-decision`).set('Authorization', `Bearer ${receptionistToken}`).send({ decision: 'aprobado' })).status).toBe(409);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' })).status).toBe(200);
    expect((await request(app).post(`/api/repairs/${repairId}/work-logs`).set('Authorization', `Bearer ${receptionistToken}`).send({ description: 'Intento no autorizado de documentar trabajo.' })).status).toBe(403);
    const withoutWork = await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'reparacion_finalizada' });
    expect(withoutWork.status).toBe(409);
    expect(withoutWork.body.error.code).toBe('WORK_LOG_REQUIRED');
    expect((await request(app).post(`/api/repairs/${repairId}/work-logs`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Se reemplazó el componente y se verificó el arranque y la carga.' })).status).toBe(201);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'reparacion_finalizada' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'listo_para_retirar' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'entregado' })).status).toBe(409);
    const deliveryBody = { pickedUpByName: 'Juan Pérez', observations: 'Entrega presencial verificada.', items: [{ id: Number((await request(app).get(`/api/intakes/${repairId}`).set('Authorization', `Bearer ${receptionistToken}`)).body.data.intake.items[0].id), returnStatus: 'devuelto' }] };
    const key = `phase4-delivery-${Date.now()}`;
    const delivery = await request(app).post(`/api/repairs/${repairId}/delivery`).set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', key).send(deliveryBody);
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.repair.status).toBe('entregado');
    const replay = await request(app).post(`/api/repairs/${repairId}/delivery`).set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', key).send(deliveryBody);
    expect(replay.status).toBe(200);
    expect((await request(app).post(`/api/repairs/${repairId}/delivery`).set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', `${key}-different`).send(deliveryBody)).status).toBe(409);
    expect((await request(app).get(`/api/repairs/${repairId}/delivery`).set('Authorization', `Bearer ${technicianToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/repairs/${repairId}/delivery`).set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(200);
    const detail = await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.workLogs).toHaveLength(1);
    expect(detail.body.data.estimateDecisions).toHaveLength(1);
    expect(detail.body.data.delivery.items[0].returnStatus).toBe('devuelto');
  });

  it('obliga a una nueva autorización después de rechazar un presupuesto', async () => {
    const intake = await request(app).post('/api/intakes').set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', `phase4-reject-intake-${Date.now()}`).send({ customerId, deviceId, problemDescription: 'Segunda orden para probar rechazo y nueva autorización.', items: [] });
    expect(intake.status).toBe(201);
    const secondRepairId = Number(intake.body.data.repair.id);
    repairIds.push(secondRepairId);
    expect((await request(app).post(`/api/repairs/${secondRepairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${secondRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_diagnostico' })).status).toBe(200);
    const estimate = await request(app).post(`/api/repairs/${secondRepairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Presupuesto a rechazar', laborCost: 100, partsCost: 50, items: [] });
    expect(estimate.status).toBe(201);
    const secondEstimateId = Number(estimate.body.data.id);
    estimateIds.push(secondEstimateId);
    expect((await request(app).patch(`/api/repairs/${secondRepairId}/estimates/${secondEstimateId}/presential-decision`).set('Authorization', `Bearer ${receptionistToken}`).send({ decision: 'rechazado', observation: 'Cliente rechaza el importe en el local.' })).status).toBe(200);
    const rejected = await request(app).get(`/api/repairs/${secondRepairId}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(rejected.body.data.status).toBe('presupuesto_rechazado');
    const blocked = await request(app).patch(`/api/repairs/${secondRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('APPROVED_ESTIMATE_REQUIRED');
    const replacement = await request(app).post(`/api/repairs/${secondRepairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Nuevo presupuesto autorizado', laborCost: 200, partsCost: 100, items: [] });
    expect(replacement.status).toBe(201);
    const replacementId = Number(replacement.body.data.id);
    estimateIds.push(replacementId);
    expect((await request(app).patch(`/api/repairs/${secondRepairId}/estimates/${replacementId}/presential-decision`).set('Authorization', `Bearer ${receptionistToken}`).send({ decision: 'aprobado', observation: 'Nueva autorización presencial registrada.' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${secondRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' })).status).toBe(200);
  });

  it('conserva integridad, auditoría y una sola decisión por presupuesto', async () => {
    const [decisions] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM estimate_decisions WHERE estimate_id IN (?)', [estimateIds]);
    const [deliveries] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM repair_deliveries WHERE repair_request_id = ?', [repairId]);
    const [duplicates] = await pool.query<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM (SELECT repair_request_id FROM estimates WHERE status='pendiente_aprobacion' GROUP BY repair_request_id HAVING COUNT(*) > 1) duplicate_groups`);
    const [orphanDecisions] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM estimate_decisions d LEFT JOIN estimates e ON e.id=d.estimate_id WHERE e.id IS NULL');
    const [orphanDeliveries] = await pool.query<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM repair_deliveries d LEFT JOIN repair_requests r ON r.id=d.repair_request_id WHERE r.id IS NULL');
    expect(Number(decisions[0].count)).toBe(3);
    expect(Number(deliveries[0].count)).toBe(1);
    expect(Number(duplicates[0].count)).toBe(0);
    expect(Number(orphanDecisions[0].count)).toBe(0);
    expect(Number(orphanDeliveries[0].count)).toBe(0);
  });

  afterAll(async () => {
    if (repairIds.length) await pool.query('DELETE FROM repair_deliveries WHERE repair_request_id IN (?)', [repairIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_decisions WHERE estimate_id IN (?)', [estimateIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_items WHERE estimate_id IN (?)', [estimateIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimates WHERE id IN (?)', [estimateIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_work_logs WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_requests WHERE id IN (?)', [repairIds]);
    if (deviceIds.length) await pool.query('DELETE FROM devices WHERE id IN (?)', [deviceIds]);
    if (customerIds.length) await pool.query('DELETE FROM customers WHERE id IN (?)', [customerIds]);
    if (invitationIds.length) await pool.query('DELETE FROM employee_invitations WHERE id IN (?)', [invitationIds]);
    if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
    await pool.end();
  });
});
