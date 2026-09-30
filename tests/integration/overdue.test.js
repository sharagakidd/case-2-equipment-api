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
import { requestRepository } from '../../src/repositories/index.js';
import { register } from '../../src/lib/metrics.js';
import { refreshBusinessMetrics } from '../../src/lib/business-metrics.js';

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

// Срок в прошлом делает работу просроченной, если заявка ещё не закрыта.
const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

// Оборудование создаём под админом: заявке нужен существующий equipmentId.
async function createEquipment() {
  const res = await request(app)
    .post('/api/equipment')
    .set(bearer(admin.token))
    .send({
      name: 'TEST-Оборудование для метрики',
      type: 'inverter',
      serialNumber: `TEST-overdue-${Date.now()}-${seq++}`,
      location: { lat: 55.7, lon: 37.6 },
    });

  return res.body.data.id;
}

async function createRequest(equipmentId, plannedAt) {
  const res = await request(app)
    .post('/api/requests')
    .set(bearer(technician.token))
    .send({
      equipmentId,
      title: `TEST-Плановая работа ${++seq}`,
      priority: 'medium',
      plannedAt,
    });

  expect(res.status).toBe(201);

  return res.body.data.id;
}

describe('просроченные плановые работы', () => {
  // Счётчик считаем разницей: в базе уже есть данные сидов, абсолютное значение плавает.
  test('заявка со сроком в прошлом попадает в счётчик', async () => {
    const before = await requestRepository.countOverdue();
    const equipmentId = await createEquipment();

    await createRequest(equipmentId, PAST);

    expect(await requestRepository.countOverdue()).toBe(before + 1);
  });

  test('заявка со сроком в будущем не считается просроченной', async () => {
    const before = await requestRepository.countOverdue();
    const equipmentId = await createEquipment();

    await createRequest(equipmentId, FUTURE);

    expect(await requestRepository.countOverdue()).toBe(before);
  });

  test('закрытая заявка выпадает из счётчика', async () => {
    const equipmentId = await createEquipment();
    const id = await createRequest(equipmentId, PAST);
    const overdue = await requestRepository.countOverdue();

    // rejected — терминальный статус, исполнители для него не нужны.
    const changed = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set(bearer(admin.token))
      .send({ status: 'rejected' });

    expect(changed.status).toBe(200);
    expect(await requestRepository.countOverdue()).toBe(overdue - 1);
  });

  test('метрика отдаётся в формате Prometheus', async () => {
    const equipmentId = await createEquipment();
    await createRequest(equipmentId, PAST);

    await refreshBusinessMetrics();

    const exposition = await register.metrics();

    expect(exposition).toMatch(/^# HELP maintenance_requests_overdue /m);
    // Метка app у всех метрик добавляется через setDefaultLabels.
    expect(exposition).toMatch(/^maintenance_requests_overdue(\{[^}]*\})? \d+$/m);
  });
});
