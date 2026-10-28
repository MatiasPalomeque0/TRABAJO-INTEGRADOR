import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { app } from '../src/server.js';
import { signAccessToken } from '../src/utils/jwt.js';

const suite = process.env.RUN_DB_INTEGRATION === 'true' ? describe : describe.skip;

suite('Fase 1: identidad, invitaciones y permisos contra la base de pruebas', () => {
  const createdUserIds: number[] = [];
  const invitationIds: number[] = [];
  let adminToken = '';
  let clientAToken = '';
  let clientBToken = '';
  let receptionistToken = '';
  let technicianAToken = '';
  let technicianBToken = '';
  let receptionistId = 0;
  let technicianAId = 0;
  let deviceId = 0;
  let repairId = 0;
  let reusedInvitationToken = '';

  async function registerClient(email: string) {
    const response = await request(app).post('/api/auth/register').send({ firstName: 'Cliente', lastName: 'Prueba', email, password: 'Cliente123', passwordConfirmation: 'Cliente123' });
    expect(response.status).toBe(201);
    createdUserIds.push(response.body.data.user.id);
    return response.body.data;
  }

  async function inviteEmployee(email: string, role: 'recepcionista' | 'tecnico') {
    const invitationResponse = await request(app).post('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`).send({ email, role });
    expect(invitationResponse.status).toBe(201);
    invitationIds.push(invitationResponse.body.data.id);
    const token = invitationResponse.body.data.token as string;
    const accepted = await request(app).post('/api/auth/employee-invitations/accept').send({ token, firstName: role, lastName: 'Prueba', password: 'Empleado123', passwordConfirmation: 'Empleado123' });
    expect(accepted.status).toBe(201);
    createdUserIds.push(accepted.body.data.id);
    return { userId: accepted.body.data.id as number, token, accessToken: signAccessToken(accepted.body.data.id as number) };
  }

  beforeAll(async () => {
    const [adminRows] = await pool.query<Array<{ id: number }>>(`
      SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'admin' AND u.is_active = 1
      ORDER BY u.id LIMIT 1
    `);
    if (!adminRows[0]) throw new Error('La base de pruebas necesita un administrador activo para ejecutar la integración.');
    adminToken = signAccessToken(Number(adminRows[0].id));

    const clientA = await registerClient(`phase1-client-a-${Date.now()}@example.test`);
    const clientB = await registerClient(`phase1-client-b-${Date.now()}@example.test`);
    clientAToken = clientA.accessToken;
    clientBToken = clientB.accessToken;
    const receptionist = await inviteEmployee(`phase1-reception-${Date.now()}@example.test`, 'recepcionista');
    const technicianA = await inviteEmployee(`phase1-tech-a-${Date.now()}@example.test`, 'tecnico');
    const technicianB = await inviteEmployee(`phase1-tech-b-${Date.now()}@example.test`, 'tecnico');
    receptionistId = receptionist.userId;
    technicianAId = technicianA.userId;
    receptionistToken = receptionist.accessToken;
    technicianAToken = technicianA.accessToken;
    technicianBToken = technicianB.accessToken;
    reusedInvitationToken = technicianB.token;
  });

  it('mantiene el registro público limitado al rol cliente', async () => {
    const [rows] = await pool.query<Array<{ slug: string }>>(`SELECT r.slug FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`, [createdUserIds[0]]);
    expect(rows.map((row) => row.slug)).toEqual(['cliente']);
    const invitations = await request(app).get('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`);
    expect(invitations.status).toBe(200);
    expect(invitations.body.data[0]).not.toHaveProperty('token');
    expect(invitations.body.data[0]).not.toHaveProperty('tokenHash');
  });

  it('permite consultar órdenes, pero rechaza operaciones administrativas para recepción', async () => {
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(403);
    expect((await request(app).get('/api/repairs').set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(200);
    expect((await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(403);
    expect((await request(app).patch('/api/users/1/roles').set('Authorization', `Bearer ${receptionistToken}`).send({ roles: ['admin'] })).status).toBe(403);
  });

  it('impide al técnico crear equipos', async () => {
    const response = await request(app).post('/api/devices').set('Authorization', `Bearer ${technicianAToken}`).send({ deviceType: 'notebook', brand: 'Prueba', model: 'Fase 1' });
    expect(response.status).toBe(403);
  });

  it('protege el acceso horizontal a reparaciones', async () => {
    const deviceResponse = await request(app).post('/api/devices').set('Authorization', `Bearer ${clientAToken}`).send({ deviceType: 'notebook', brand: 'Prueba', model: 'Equipo Fase 1' });
    expect(deviceResponse.status).toBe(201);
    deviceId = deviceResponse.body.data.id;
    const repairResponse = await request(app).post('/api/repairs').set('Authorization', `Bearer ${clientAToken}`).send({ deviceId, problemDescription: 'Falla controlada para pruebas de permisos.' });
    expect(repairResponse.status).toBe(201);
    repairId = repairResponse.body.data.id;
    expect((await request(app).post(`/api/repairs/${repairId}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ technicianId: technicianAId })).status).toBe(200);
    expect((await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${technicianBToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/repairs/${repairId}`).set('Authorization', `Bearer ${clientBToken}`)).status).toBe(403);
  });

  it('rechaza el segundo uso de una invitación', async () => {
    const response = await request(app).post('/api/auth/employee-invitations/accept').send({ token: reusedInvitationToken, firstName: 'Repetido', lastName: 'Prueba', password: 'Empleado123', passwordConfirmation: 'Empleado123' });
    expect(response.status).toBe(409);
  });

  it('rechaza una invitación vencida o manipulada', async () => {
    const invitationResponse = await request(app).post('/api/users/invitations').set('Authorization', `Bearer ${adminToken}`).send({ email: `phase1-expired-${Date.now()}@example.test`, role: 'tecnico', expiresInHours: 1 });
    expect(invitationResponse.status).toBe(201);
    invitationIds.push(invitationResponse.body.data.id);
    await pool.execute('UPDATE employee_invitations SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?', [invitationResponse.body.data.id]);
    const expired = await request(app).post('/api/auth/employee-invitations/accept').send({ token: invitationResponse.body.data.token, firstName: 'Vencido', lastName: 'Prueba', password: 'Empleado123', passwordConfirmation: 'Empleado123' });
    expect(expired.status).toBe(410);
    const manipulated = await request(app).post('/api/auth/employee-invitations/accept').send({ token: `${invitationResponse.body.data.token}x`, firstName: 'Falso', lastName: 'Prueba', password: 'Empleado123', passwordConfirmation: 'Empleado123' });
    expect(manipulated.status).toBe(404);
  });

  it('rechaza una sesión de una cuenta deshabilitada', async () => {
    expect((await request(app).patch(`/api/users/${receptionistId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ isActive: false })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${receptionistToken}`)).status).toBe(401);
  });

  it('protege al último administrador activo cuando la base tiene uno solo', async () => {
    const [rows] = await pool.query<Array<{ total: number }>>(`
      SELECT COUNT(*) AS total FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'admin' AND u.is_active = 1
    `);
    if (Number(rows[0].total) !== 1) return;
    const [adminRows] = await pool.query<Array<{ id: number }>>(`
      SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'admin' AND u.is_active = 1 LIMIT 1
    `);
    const response = await request(app).patch(`/api/users/${adminRows[0].id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ isActive: false });
    expect(response.status).toBe(409);
  });

  afterAll(async () => {
    if (repairId) {
      await pool.execute('DELETE FROM repair_status_history WHERE repair_request_id = ?', [repairId]);
      await pool.execute('DELETE FROM repair_requests WHERE id = ?', [repairId]);
    }
    if (deviceId) await pool.execute('DELETE FROM devices WHERE id = ?', [deviceId]);
    if (invitationIds.length) await pool.query('DELETE FROM employee_invitations WHERE id IN (?)', [invitationIds]);
    if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
    await pool.end();
  });
});
