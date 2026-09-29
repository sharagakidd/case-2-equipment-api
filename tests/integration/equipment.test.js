import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  app,
  request,
  sequelize,
  prepareTestDatabase,
  cleanupTestData,
  createSessionUsers,
  bearer,
  firstSiteId,
} from './helpers/test-context.js';

let admin;
let seq = 0;

beforeAll(async () => {
  prepareTestDatabase();
  const users = await createSessionUsers();
  admin = users.admin;
}, 60_000);

beforeEach(() => cleanupTestData(), 30_000);
afterAll(() => sequelize.close());

const payload = (overrides = {}) => ({
  name: 'TEST-Ветротурбина',
  type: 'turbine',
  serialNumber: `TEST-${Date.now()}-${seq++}`,
  location: { lat: 55.7558, lon: 37.6173 },
  ...overrides,
});

const createEquipment = (overrides = {}) =>
  request(app).post('/api/equipment').set(bearer(admin.token)).send(payload(overrides));

describe('оборудование: создание', () => {
  test('201 с Location, статусом по умолчанию и координатами', async () => {
    const res = await createEquipment({ name: 'TEST-Подстанция', type: 'substation' });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/equipment/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      name: 'TEST-Подстанция',
      type: 'substation',
      status: 'operational',
    });

    const [rows] = await sequelize.query('SELECT lat, lon FROM equipment WHERE id = :id', {
      replacements: { id: res.body.data.id },
    });
    expect(Number(rows[0].lat)).toBeCloseTo(55.7558, 4);
    expect(Number(rows[0].lon)).toBeCloseTo(37.6173, 4);
  });

  test('созданную технику можно прочитать по id', async () => {
    const created = await createEquipment();

    const res = await request(app).get(`/api/equipment/${created.body.data.id}`).set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.serialNumber).toBe(created.body.data.serialNumber);
  });

  test('можно привязать к площадке из справочника', async () => {
    const siteId = await firstSiteId();

    const res = await createEquipment({ siteId });

    expect(res.status).toBe(201);
    expect(res.body.data.siteId).toBe(siteId);
  });

  test('повторный serialNumber → 409', async () => {
    const serialNumber = `TEST-duplicate-${Date.now()}`;
    await createEquipment({ serialNumber });

    const res = await createEquipment({ serialNumber });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test.each([
    ['нет location', { location: undefined }],
    ['неизвестный тип', { type: 'reactor' }],
    ['короткое имя', { name: 'ok' }],
    ['пустой serialNumber', { serialNumber: '' }],
  ])('%s → 422', async (_case, overrides) => {
    const res = await createEquipment(overrides);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  test('дата установки в будущем → 422', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

    const res = await createEquipment({ installedAt: tomorrow });

    expect(res.status).toBe(422);
  });
});

describe('оборудование: чтение списка', () => {
  test('пагинация ограничивает выборку и заполняет meta', async () => {
    await createEquipment();
    await createEquipment();

    const res = await request(app).get('/api/equipment?limit=1').set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  test('сортировка по имени работает без ошибок', async () => {
    const res = await request(app).get('/api/equipment?sortBy=name&order=desc&limit=5').set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('мусорный id → 422, несуществующий → 404', async () => {
    const invalid = await request(app).get('/api/equipment/not-a-uuid').set(bearer(admin.token));
    const missing = await request(app)
      .get('/api/equipment/11111111-1111-4111-8111-111111111111')
      .set(bearer(admin.token));

    expect(invalid.status).toBe(422);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});

describe('оборудование: изменение и удаление', () => {
  test('PATCH меняет переданные поля', async () => {
    const created = await createEquipment();

    const res = await request(app)
      .patch(`/api/equipment/${created.body.data.id}`)
      .set(bearer(admin.token))
      .send({ status: 'maintenance', name: 'TEST-переименовано' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'maintenance', name: 'TEST-переименовано' });
    expect(res.body.data.serialNumber).toBe(created.body.data.serialNumber);
  });

  test('PATCH несуществующей техники → 404', async () => {
    const res = await request(app)
      .patch('/api/equipment/11111111-1111-4111-8111-111111111111')
      .set(bearer(admin.token))
      .send({ name: 'TEST-ничего' });

    expect(res.status).toBe(404);
  });

  test('DELETE → 204, повторное чтение → 404, из списка пропадает', async () => {
    const created = await createEquipment();
    const id = created.body.data.id;

    const deleted = await request(app).delete(`/api/equipment/${id}`).set(bearer(admin.token));
    expect(deleted.status).toBe(204);

    const readAfter = await request(app).get(`/api/equipment/${id}`).set(bearer(admin.token));
    expect(readAfter.status).toBe(404);

    const list = await request(app).get('/api/equipment?limit=100').set(bearer(admin.token));
    expect(list.body.data.map((item) => item.id)).not.toContain(id);
  });
});
