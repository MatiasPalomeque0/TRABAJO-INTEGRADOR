import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app } from '../src/server.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_PHASE5_1_INTEGRATION === 'true' ? describe : describe.skip;

suite('Fase 5.1: cierre operativo de reparaciones entregadas', () => {
  const customerIds: number[] = [];
  const deviceIds: number[] = [];
  const repairIds: number[] = [];
  const estimateIds: number[] = [];
  let adminToken = '';
  let technicianToken = '';
  let technicianId = 0;
  let customerId = 0;
  let deliveredRepairId = 0;
  let approvedEstimateId = 0;
  let openRepairId = 0;

  beforeAll(async () => {
    const [admins] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'admin' ORDER BY u.id LIMIT 1`);
    const [technicians] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.is_active = 1 AND r.slug = 'tecnico' ORDER BY u.id LIMIT 1`);
    if (!admins[0] || !technicians[0]) throw new Error('La base de ensayo necesita un administrador y un técnico activos.');
    adminToken = signAccessToken(Number(admins[0].id));
    technicianId = Number(technicians[0].id);
    technicianToken = signAccessToken(technicianId);

    const customer = await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send({ firstName: 'Cliente', lastName: 'Fase 5.1', documentNumber: `F51-${Date.now()}`, phone: '1100000000' });
    expect(customer.status).toBe(201);
    customerId = Number(customer.body.data.id);
    customerIds.push(customerId);

    const deliveredDevice = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ customerId, deviceType: 'notebook', brand: 'TechFix', model: 'Cierre entregado', description: 'Fixture de orden cerrada.' });
    expect(deliveredDevice.status).toBe(201);
    const deliveredDeviceId = Number(deliveredDevice.body.data.id);
    deviceIds.push(deliveredDeviceId);

    const deliveredIntake = await request(app).post('/api/intakes').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `phase5-1-delivered-${Date.now()}`).send({ customerId, deviceId: deliveredDeviceId, problemDescription: 'Orden completa para probar el cierre operativo.', items: [] });
    expect(deliveredIntake.status).toBe(201);
    deliveredRepairId = Number(deliveredIntake.body.data.repair.id);
    repairIds.push(deliveredRepairId);
    expect((await request(app).post(`/api/repairs/${deliveredRepairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId })).status).toBe(200);
    expect((await request(app).post(`/api/repairs/${deliveredRepairId}/diagnosis`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Diagnóstico de fixture para cerrar la orden.', recommendation: 'Continuar con presupuesto.' })).status).toBe(201);
    expect((await request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_diagnostico' })).status).toBe(200);
    const estimate = await request(app).post(`/api/repairs/${deliveredRepairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Presupuesto de fixture', laborCost: 100, partsCost: 50, items: [] });
    expect(estimate.status).toBe(201);
    approvedEstimateId = Number(estimate.body.data.id);
    estimateIds.push(approvedEstimateId);
    expect((await request(app).patch(`/api/repairs/${deliveredRepairId}/estimates/${approvedEstimateId}/presential-decision`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'aprobado', observation: 'Aprobación de fixture.' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'en_reparacion' })).status).toBe(200);
    expect((await request(app).post(`/api/repairs/${deliveredRepairId}/work-logs`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Trabajo de fixture documentado antes del cierre.' })).status).toBe(201);
    expect((await request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'reparacion_finalizada' })).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${technicianToken}`).send({ status: 'listo_para_retirar' })).status).toBe(200);
    const delivery = await request(app).post(`/api/repairs/${deliveredRepairId}/delivery`).set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `phase5-1-delivery-${Date.now()}`).send({ pickedUpByName: 'Persona de prueba', observations: 'Entrega de fixture.', items: [] });
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.repair.status).toBe('entregado');

    const openDevice = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ customerId, deviceType: 'desktop', brand: 'TechFix', model: 'Orden abierta', description: 'Fixture de reparación no entregada.' });
    expect(openDevice.status).toBe(201);
    const openDeviceId = Number(openDevice.body.data.id);
    deviceIds.push(openDeviceId);
    const openIntake = await request(app).post('/api/intakes').set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `phase5-1-open-${Date.now()}`).send({ customerId, deviceId: openDeviceId, problemDescription: 'Orden abierta para comprobar operaciones legítimas.', items: [] });
    expect(openIntake.status).toBe(201);
    openRepairId = Number(openIntake.body.data.repair.id);
    repairIds.push(openRepairId);
    expect((await request(app).post(`/api/repairs/${openRepairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId })).status).toBe(200);
  });

  it('permite consultar una orden entregada y conserva su historial', async () => {
    const adminDetail = await request(app).get(`/api/repairs/${deliveredRepairId}`).set('Authorization', `Bearer ${adminToken}`);
    const technicianDetail = await request(app).get(`/api/repairs/${deliveredRepairId}`).set('Authorization', `Bearer ${technicianToken}`);
    expect(adminDetail.status).toBe(200);
    expect(technicianDetail.status).toBe(200);
    expect(adminDetail.body.data.status).toBe('entregado');
    expect(adminDetail.body.data.diagnoses).toHaveLength(1);
    expect(adminDetail.body.data.estimates).toHaveLength(1);
    expect(adminDetail.body.data.workLogs).toHaveLength(1);
    expect(adminDetail.body.data.delivery).not.toBeNull();
    expect(adminDetail.body.data.history.at(-1).newStatus).toBe('entregado');
  });

  it('rechaza las mutaciones operativas y la segunda entrega con códigos 409 específicos', async () => {
    const body = { description: 'Intento posterior al cierre de la orden.', recommendation: 'No debe persistirse.' };
    const estimateBody = { notes: 'No debe persistir', laborCost: 10, partsCost: 5, items: [] };
    const photoBody = { fileData: 'a'.repeat(120), mimeType: 'image/jpeg', description: 'No debe persistir.' };
    const checks = [
      request(app).post(`/api/repairs/${deliveredRepairId}/diagnosis`).set('Authorization', `Bearer ${technicianToken}`).send(body),
      request(app).post(`/api/repairs/${deliveredRepairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send(estimateBody),
      request(app).post(`/api/repairs/${deliveredRepairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId }),
      request(app).post(`/api/repairs/${deliveredRepairId}/work-logs`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'No debe registrarse un trabajo después de entregar.' }),
      request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'en_diagnostico' }),
      request(app).patch(`/api/repairs/${deliveredRepairId}/estimates/${approvedEstimateId}/presential-decision`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'rechazado' }),
      request(app).patch(`/api/repairs/${deliveredRepairId}/estimates/${approvedEstimateId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'reemplazado' }),
      request(app).post(`/api/repairs/${deliveredRepairId}/photos`).set('Authorization', `Bearer ${technicianToken}`).send(photoBody),
      request(app).post(`/api/repairs/${deliveredRepairId}/delivery`).set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', `phase5-1-second-delivery-${Date.now()}`).send({ pickedUpByName: 'Segundo intento', items: [] })
    ];
    const responses = await Promise.all(checks);
    expect(responses).toHaveLength(9);
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe(index === responses.length - 1 ? 'DELIVERY_ALREADY_REGISTERED' : 'REPAIR_CLOSED');
    }
  });

  it('mantiene la restricción bajo solicitudes concurrentes y no crea registros nuevos', async () => {
    const before = await request(app).get(`/api/repairs/${deliveredRepairId}`).set('Authorization', `Bearer ${adminToken}`);
    const responses = await Promise.all([
      request(app).post(`/api/repairs/${deliveredRepairId}/diagnosis`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Carrera controlada de diagnóstico.', recommendation: null }),
      request(app).post(`/api/repairs/${deliveredRepairId}/estimates`).set('Authorization', `Bearer ${technicianToken}`).send({ notes: 'Carrera controlada de presupuesto', laborCost: 1, partsCost: 1, items: [] }),
      request(app).patch(`/api/repairs/${deliveredRepairId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'en_diagnostico' }),
      request(app).post(`/api/repairs/${deliveredRepairId}/work-logs`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Carrera controlada de trabajo.' }),
      request(app).post(`/api/repairs/${deliveredRepairId}/photos`).set('Authorization', `Bearer ${technicianToken}`).send({ fileData: 'b'.repeat(120), mimeType: 'image/jpeg' })
    ]);
    expect(responses.every((response) => response.status === 409)).toBe(true);
    expect(responses.every((response) => response.body.error.code === 'REPAIR_CLOSED')).toBe(true);
    const after = await request(app).get(`/api/repairs/${deliveredRepairId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.data.diagnoses).toHaveLength(before.body.data.diagnoses.length);
    expect(after.body.data.estimates).toHaveLength(before.body.data.estimates.length);
    expect(after.body.data.workLogs).toHaveLength(before.body.data.workLogs.length);
    expect(after.body.data.photos).toHaveLength(before.body.data.photos.length);
    expect(after.body.data.status).toBe('entregado');
  });

  it('mantiene habilitadas las operaciones legítimas en una reparación no entregada', async () => {
    const diagnosis = await request(app).post(`/api/repairs/${openRepairId}/diagnosis`).set('Authorization', `Bearer ${technicianToken}`).send({ description: 'Diagnóstico permitido en una orden abierta.', recommendation: 'Continuar con revisión.' });
    expect(diagnosis.status).toBe(201);
  });

  afterAll(async () => {
    if (repairIds.length) await pool.query('DELETE FROM repair_deliveries WHERE repair_request_id IN (?)', [repairIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_decisions WHERE estimate_id IN (?)', [estimateIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimate_items WHERE estimate_id IN (?)', [estimateIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_photos WHERE repair_request_id IN (?)', [repairIds]);
    if (estimateIds.length) await pool.query('DELETE FROM estimates WHERE id IN (?)', [estimateIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_work_logs WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM diagnoses WHERE repair_request_id IN (?)', [repairIds]);
    if (repairIds.length) await pool.query('DELETE FROM repair_requests WHERE id IN (?)', [repairIds]);
    if (deviceIds.length) await pool.query('DELETE FROM devices WHERE id IN (?)', [deviceIds]);
    if (customerIds.length) await pool.query('DELETE FROM customers WHERE id IN (?)', [customerIds]);
    await pool.end();
  });
});
