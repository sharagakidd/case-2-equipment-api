import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  app,
  request,
  sequelize,
  prepareTestDatabase,
  cleanupTestData,
  createSessionUsers,
  registerUser,
  assignRole,
  tokenFor,
  uniqueEmail,
  bearer,
} from './helpers/test-context.js';

let admin;
let technician;
let seq = 0;

beforeAll(async () => {
  prepareTestDatabase();
  const users = await createSessionUsers();
  admin = users.admin;
  technician = users.technician;
}, 60_000);

beforeEach(() => cleanupTestData(), 30_000);
afterAll(() => sequelize.close());

// Оборудование создаём под админом: заявке нужен существующий equipmentId.
async function createEquipment() {
  const res = await request(app)
    .post('/api/equipment')
    .set(bearer(admin.token))
    .send({
      name: 'TEST-Оборудование для заявок',
      type: 'inverter',
      serialNumber: `TEST-req-${Date.now()}-${seq++}`,
      location: { lat: 55.7, lon: 37.6 },
    });

  return res.body.data.id;
}

function createRequest(equipmentId) {
  return request(app)
    .post('/api/requests')
    .set(bearer(technician.token))
    .send({ equipmentId, title: `TEST-Заявка ${++seq}`, priority: 'high' });
}

describe('заявки: создание', () => {
  test('technician создаёт заявку → 201 в статусе new', async () => {
    const equipmentId = await createEquipment();

    const res = await createRequest(equipmentId);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/requests/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({ equipmentId, status: 'new', priority: 'high' });
  });

  test('несуществующее оборудование → 404', async () => {
    const res = await createRequest('11111111-1111-4111-8111-111111111111');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('слишком короткий заголовок → 422', async () => {
    const equipmentId = await createEquipment();

    const res = await request(app)
      .post('/api/requests')
      .set(bearer(technician.token))
      .send({ equipmentId, title: 'TEST' });

    expect(res.status).toBe(422);
  });
});

describe('заявки: чтение и правка', () => {
  test('список с meta и чтение по id', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const list = await request(app).get('/api/requests?limit=5').set(bearer(technician.token));
    const one = await request(app).get(`/api/requests/${created.body.data.id}`).set(bearer(technician.token));

    expect(list.status).toBe(200);
    expect(list.body.meta.limit).toBe(5);
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe(created.body.data.id);
  });

  test('PATCH меняет заголовок и приоритет', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const res = await request(app)
      .patch(`/api/requests/${created.body.data.id}`)
      .set(bearer(technician.token))
      .send({ title: 'TEST-Заявка переименована', priority: 'critical' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'TEST-Заявка переименована', priority: 'critical' });
  });

  test('несуществующая заявка → 404', async () => {
    const res = await request(app)
      .get('/api/requests/11111111-1111-4111-8111-111111111111')
      .set(bearer(technician.token));

    expect(res.status).toBe(404);
  });
});

describe('заявки: жизненный цикл статуса', () => {
  test('в работу без бригады не берут → 409', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const res = await request(app)
      .patch(`/api/requests/${created.body.data.id}/status`)
      .set(bearer(technician.token))
      .send({ status: 'in_progress' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('бригада → in_progress → done, история фиксирует переходы', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);
    const id = created.body.data.id;

    const assigned = await request(app)
      .post(`/api/requests/${id}/assignees`)
      .set(bearer(admin.token))
      .send({ assignees: [{ technicianId: technician.technicianId, role: 'lead', hours: 3 }] });
    expect(assigned.status).toBe(201);

    const inProgress = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set(bearer(technician.token))
      .send({ status: 'in_progress' });
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.data.status).toBe('in_progress');

    const history = await request(app).get(`/api/requests/${id}/history`).set(bearer(admin.token));
    expect(history.status).toBe(200);
    expect(history.body.data.some((record) => record.newStatus === 'in_progress')).toBe(true);
    expect(history.body.data.at(-1).author).toBe(technician.email);

    const done = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set(bearer(technician.token))
      .send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('done');

    const reopened = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set(bearer(technician.token))
      .send({ status: 'in_progress' });
    expect(reopened.status).toBe(409);
  });

  test('technician не из бригады не меняет статус → 403', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const otherEmail = uniqueEmail();
    const [technicians] = await sequelize.query('SELECT id FROM technicians OFFSET 1 LIMIT 1');
    await registerUser(otherEmail);
    await assignRole(otherEmail, 'technician', technicians[0].id);
    const otherToken = await tokenFor(otherEmail);

    const res = await request(app)
      .patch(`/api/requests/${created.body.data.id}/status`)
      .set(bearer(otherToken))
      .send({ status: 'rejected' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('заявки: правила бригады через API', () => {
  test('два lead → 422 с деталями по полю assignees', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const res = await request(app)
      .post(`/api/requests/${created.body.data.id}/assignees`)
      .set(bearer(admin.token))
      .send({
        assignees: [
          { technicianId: technician.technicianId, role: 'lead' },
          { technicianId: technician.technicianId, role: 'lead' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('assignees');
  });

  test('удаление заявки админом → 204', async () => {
    const equipmentId = await createEquipment();
    const created = await createRequest(equipmentId);

    const res = await request(app).delete(`/api/requests/${created.body.data.id}`).set(bearer(admin.token));

    expect(res.status).toBe(204);
  });
});
