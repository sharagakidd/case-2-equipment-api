import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  app,
  request,
  sequelize,
  prepareTestDatabase,
  cleanupTestData,
  createSessionUsers,
  bearer,
} from './helpers/test-context.js';

beforeAll(() => prepareTestDatabase(), 60_000);
beforeEach(() => cleanupTestData(), 30_000);
afterAll(() => sequelize.close());

const SOME_ID = '11111111-1111-4111-8111-111111111111';

describe('доступ без токена → 401', () => {
  test.each([
    ['get', '/api/equipment'],
    ['get', `/api/equipment/${SOME_ID}`],
    ['get', `/api/equipment/${SOME_ID}/requests`],
    ['get', '/api/requests'],
    ['get', `/api/requests/${SOME_ID}/history`],
    ['get', `/api/sites/${SOME_ID}/summary`],
    ['get', '/api/reports/equipment-load'],
    ['post', '/api/equipment'],
    ['post', '/api/requests'],
    ['patch', `/api/requests/${SOME_ID}/status`],
    ['delete', `/api/requests/${SOME_ID}`],
  ])('%s %s → 401', async (method, path) => {
    const res = await request(app)[method](path).send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('заголовок без схемы Bearer считается отсутствием токена → 401', async () => {
    const res = await request(app).get('/api/equipment').set({ Authorization: 'token-without-scheme' });

    expect(res.status).toBe(401);
  });

  test('битый токен → 403: подпись не проходит проверку', async () => {
    const res = await request(app).get('/api/equipment').set(bearer('not-a-real-jwt'));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('служебный health доступен без токена', async () => {
    const res = await request(app).get('/api/health/live');

    expect(res.status).toBe(200);
  });
});

describe('недостаточные права → 403', () => {
  let users;
  const newEquipment = { name: 'TEST-Создание', type: 'turbine', serialNumber: 'TEST-403', location: { lat: 55.7, lon: 37.6 } };

  beforeAll(async () => {
    users = await createSessionUsers();
  }, 60_000);

  test('viewer не может создать оборудование (только admin)', async () => {
    const res = await request(app).post('/api/equipment').set(bearer(users.viewer.token)).send(newEquipment);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('viewer не может удалить оборудование', async () => {
    const res = await request(app).delete(`/api/equipment/${SOME_ID}`).set(bearer(users.viewer.token));

    expect(res.status).toBe(403);
  });

  test('viewer не может создать заявку (нужен technician или admin)', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set(bearer(users.viewer.token))
      .send({ equipmentId: SOME_ID, title: 'TEST-заявка от viewer' });

    expect(res.status).toBe(403);
  });

  test('technician не может создать оборудование', async () => {
    const res = await request(app).post('/api/equipment').set(bearer(users.technician.token)).send(newEquipment);

    expect(res.status).toBe(403);
  });

  test('technician не может назначить бригаду (только admin)', async () => {
    const res = await request(app)
      .post(`/api/requests/${SOME_ID}/assignees`)
      .set(bearer(users.technician.token))
      .send({ assignees: [{ technicianId: users.technician.technicianId, role: 'lead' }] });

    expect(res.status).toBe(403);
  });

  test('technician не может удалить заявку', async () => {
    const res = await request(app).delete(`/api/requests/${SOME_ID}`).set(bearer(users.technician.token));

    expect(res.status).toBe(403);
  });

  test('viewer читает справочник: чтение открыто любой роли, вошедшей в систему', async () => {
    const res = await request(app).get('/api/equipment').set(bearer(users.viewer.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('technician видит список заявок', async () => {
    const res = await request(app).get('/api/requests').set(bearer(users.technician.token));

    expect(res.status).toBe(200);
  });
});
