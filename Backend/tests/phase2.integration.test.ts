import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app } from '../src/server.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_PHASE2_INTEGRATION === 'true' ? describe : describe.skip;

suite('Fase 2: circuito presencial contra una base derivada 001–004', () => {
  const createdUserIds: number[] = [];
  const invitationIds: number[] = [];
  let adminToken = '';
  let technicianToken = '';
  let receptionistToken = '';
  let clientToken = '';
  let receptionistId = 0;
  let technicianId = 0;
  let customerId = 0;
  let deviceId = 0;
  let repairId = 0;
  let intakeId = 0;
  let clientUserId = 0;
  let beforeCounts: { users: number; roles: number; devices: number; repairs: number; history: number };

  beforeAll(async () => {
    const [adminRows] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.slug='admin' AND u.is_active=1 ORDER BY u.id LIMIT 1`);
    const [technicianRows] = await pool.query<Array<{ id: number }>>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.slug='tecnico' AND u.is_active=1 ORDER BY u.id LIMIT 1`);
    if (!adminRows[0] || !technicianRows[0]) throw new Error('La base Fase 2 necesita un administrador y un técnico activos.');
    adminToken = signAccessToken(Number(adminRows[0].id));
    technicianId = Number(technicianRows[0].id);
    technicianToken = signAccessToken(technicianId);
    const [counts] = await pool.query<Array<{ users: number; roles: number; devices: number; repairs: number; history: number }>>(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM roles) AS roles, (SELECT COUNT(*) FROM devices) AS devices, (SELECT COUNT(*) FROM repair_requests) AS repairs, (SELECT COUNT(*) FROM repair_status_history) AS history`);
    beforeCounts = { users: Number(counts[0].users), roles: Number(counts[0].roles), devices: Number(counts[0].devices), repairs: Number(counts[0].repairs), history: Number(counts[0].history) };
    const invitation = await request(app).post('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`).send({ email: `phase2-reception-${Date.now()}@example.test`, role: 'recepcionista' });
    expect(invitation.status).toBe(201);
    invitationIds.push(invitation.body.data.id);
    const accepted = await request(app).post('/api/auth/employee-invitations/accept').send({ token: invitation.body.data.token, firstName: 'Recepción', lastName: 'Fase 2', password: 'Recepcion123', passwordConfirmation: 'Recepcion123' });
    expect(accepted.status).toBe(201);
    receptionistId = Number(accepted.body.data.id);
    receptionistToken = signAccessToken(receptionistId);
    createdUserIds.push(receptionistId);
    const client = await request(app).post('/api/auth/register').send({ firstName: 'Cliente', lastName: 'Legado', email: `phase2-client-${Date.now()}@example.test`, password: 'Cliente123', passwordConfirmation: 'Cliente123' });
    expect(client.status).toBe(201);
    clientToken = client.body.data.accessToken;
    clientUserId = Number(client.body.data.user.id);
    createdUserIds.push(clientUserId);
  });

  it('expone únicamente técnicos activos al administrador', async () => {
    const adminResponse = await request(app).get('/api/users/technicians').set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: technicianId, isActive: true })]));
    expect(adminResponse.body.data.every((item: { isActive: boolean; roles: string[] }) => item.isActive && item.roles.includes('tecnico'))).toBe(true);
    expect((await request(app).get('/api/users/technicians').set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(403);
  });

  it('permite el circuito cliente comercial → equipo → ingreso → orden', async () => {
    expect((await request(app).post('/api/customers').set('Authorization', `Bearer ${technicianToken}`).send({ firstName: 'No', lastName: 'Autorizado' })).status).toBe(403);
    const customer = await request(app).post('/api/customers').set('Authorization', `Bearer ${receptionistToken}`).send({ firstName: 'Ana', lastName: 'Comercial', documentNumber: `F2-${Date.now()}`, phone: '11223344' });
    expect(customer.status).toBe(201);
    customerId = customer.body.data.id;
    const device = await request(app).post('/api/devices').set('Authorization', `Bearer ${receptionistToken}`).send({ customerId, deviceType: 'notebook', brand: 'TechFix', model: 'Presencial', description: 'Equipo de prueba Fase 2' });
    expect(device.status).toBe(201);
    deviceId = device.body.data.id;
    expect(device.body.data.ownerId).toBeNull();
    expect((await request(app).post('/api/devices').set('Authorization', `Bearer ${technicianToken}`).send({ customerId, deviceType: 'desktop', brand: 'No', model: 'Autorizado' })).status).toBe(403);
    const key = `phase2-${Date.now()}-intake`;
    const body = { customerId, deviceId, problemDescription: 'No inicia y muestra una pantalla negra.', equipmentCondition: 'Rayón leve en la tapa.', observations: 'Cliente solicita diagnóstico.', items: [{ description: 'Cargador original', conditionAtIntake: 'Funciona' }, { description: 'Mochila', conditionAtIntake: 'Usada' }] };
    const intake = await request(app).post('/api/intakes').set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', key).send(body);
    expect(intake.status).toBe(201);
    repairId = intake.body.data.repair.id;
    intakeId = intake.body.data.intake.id;
    expect(intake.body.data.repair.customerId).toBe(customerId);
    expect(intake.body.data.intake.items).toHaveLength(2);
    const replay = await request(app).post('/api/intakes').set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', key).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.data.repair.id).toBe(repairId);
    const conflict = await request(app).post('/api/intakes').set('Authorization', `Bearer ${receptionistToken}`).set('Idempotency-Key', key).send({ ...body, problemDescription: 'Otro problema diferente.' });
    expect(conflict.status).toBe(409);
  });

  it('protege la información comercial y conserva el alcance técnico', async () => {
    expect((await request(app).get(`/api/customers/${customerId}`).set('Authorization', `Bearer ${technicianToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/intakes/${repairId}`).set('Authorization', `Bearer ${technicianToken}`)).status).toBe(403);
    expect((await request(app).post('/api/intakes').set('Authorization', `Bearer ${technicianToken}`).set('Idempotency-Key', `phase2-tech-${Date.now()}-key`).send({ customerId, deviceId, problemDescription: 'Intento no autorizado.', items: [] })).status).toBe(403);
    expect((await request(app).get(`/api/customers/${customerId}`).set('Authorization', `Bearer ${clientToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(200);
    expect((await request(app).patch(`/api/repairs/${repairId}/status`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'cancelado' })).status).toBe(403);
  });

  it('permite al técnico asignado consultar el equipo y la orden', async () => {
    expect((await request(app).post(`/api/repairs/${repairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId: clientUserId })).status).toBe(404);
    expect((await request(app).post(`/api/repairs/${repairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId })).status).toBe(200);
    expect((await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${technicianToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/devices/${deviceId}`).set('Authorization', `Bearer ${technicianToken}`)).status).toBe(200);
  });

  it('mantiene los registros históricos y crea únicamente las filas nuevas esperadas', async () => {
    const [counts] = await pool.query<Array<{ users: number; roles: number; devices: number; repairs: number; history: number }>>(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM roles) AS roles, (SELECT COUNT(*) FROM devices) AS devices, (SELECT COUNT(*) FROM repair_requests) AS repairs, (SELECT COUNT(*) FROM repair_status_history) AS history`);
    expect(Number(counts[0].users)).toBe(beforeCounts.users + 2);
    expect(Number(counts[0].roles)).toBe(beforeCounts.roles);
    expect(Number(counts[0].devices)).toBe(beforeCounts.devices + 1);
    expect(Number(counts[0].repairs)).toBe(beforeCounts.repairs + 1);
    expect(Number(counts[0].history)).toBe(beforeCounts.history + 1);
    const intake = await request(app).get(`/api/intakes/${repairId}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(intake.status).toBe(200);
    expect(intake.body.data.intake.id).toBe(intakeId);
  });

  afterAll(async () => {
    if (repairId) await pool.execute('DELETE FROM repair_requests WHERE id = ?', [repairId]);
    if (deviceId) await pool.execute('DELETE FROM devices WHERE id = ?', [deviceId]);
    if (customerId) await pool.execute('DELETE FROM customers WHERE id = ?', [customerId]);
    if (invitationIds.length) await pool.query('DELETE FROM employee_invitations WHERE id IN (?)', [invitationIds]);
    if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
    await pool.end();
  });
});
