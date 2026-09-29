import { execSync } from 'node:child_process';
import request from 'supertest';

// Тесты работают с отдельной базой (сервис db_test, порт 5433): данные разработки
// не затрагиваются даже при ошибке в тесте. Переменные ставим до импорта приложения,
// потому что dotenv не перезаписывает уже заданные значения.
process.env.PGDATABASE = 'equipment_api_test';
process.env.PGPORT = process.env.TEST_PGPORT ?? '5433';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DOTENV_CONFIG_QUIET = 'true';
// Лимиты частоты в тестах не мешают: серия запросов идёт с одного адреса.
process.env.RATE_LIMIT_MAX = '10000';
process.env.LOGIN_RATE_LIMIT_MAX = '10000';

const { default: app } = await import('../../../src/app.js');
const { sequelize } = await import('../../../src/db/index.js');

export { app, request, sequelize };

// sequelize-cli идемпотентен: применённые миграции и сиды он помнит в SequelizeMeta
// и SequelizeData, поэтому вызов безопасен на каждом прогоне.
export function prepareTestDatabase() {
  // В src/db/config.js описан только блок development, поэтому CLI запускаем с
  // NODE_ENV=development: на тестовую базу его переводит PGDATABASE.
  const env = { ...process.env, NODE_ENV: 'development' };

  execSync('npx sequelize-cli db:migrate', { env, stdio: 'pipe' });
  execSync('npx sequelize-cli db:seed:all', { env, stdio: 'pipe' });
}

// Чистим только тестовые данные: справочники (площадки, техники) и демо-набор остаются,
// поэтому каждый тест стартует с предсказуемого состояния.
export async function cleanupTestData() {
  await sequelize.query("DELETE FROM maintenance_requests WHERE title LIKE 'TEST-%'");
  await sequelize.query("DELETE FROM equipment WHERE serial_number LIKE 'TEST-%'");
  await sequelize.query("DELETE FROM users WHERE email LIKE '%@test.local'");
}

export function uniqueEmail() {
  return `test-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`;
}

export const PASSWORD = 'Passw0rd!2345';

export function registerUser(email, password = PASSWORD, extra = {}) {
  return request(app).post('/api/auth/register').send({ email, password, ...extra });
}

export function login(email, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

export async function tokenFor(email, password = PASSWORD) {
  const res = await login(email, password);
  return res.body.data.accessToken;
}

// Роли выдаёт только админ, поэтому в тестах повышаем их напрямую в базе.
export async function assignRole(email, role, technicianId = null) {
  await sequelize.query('UPDATE users SET role = :role, technician_id = :technicianId WHERE email = :email', {
    replacements: { role, technicianId, email },
  });
}

export async function firstTechnicianId() {
  const [rows] = await sequelize.query('SELECT id FROM technicians LIMIT 1');
  return rows[0]?.id ?? null;
}

export async function firstSiteId() {
  const [rows] = await sequelize.query('SELECT id FROM sites LIMIT 1');
  return rows[0]?.id ?? null;
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

// Пользователи для набора тестов: почта в домене session.test, поэтому обычная
// очистка тестовых данных их не удаляет — токены и technician_id живут весь прогон.
export async function createSessionUsers() {
  const technicianId = await firstTechnicianId();
  const spec = [
    ['admin', 'admin', null],
    ['technician', 'technician', technicianId],
    ['viewer', 'viewer', null],
  ];
  const users = {};

  for (const [name, role, linkedTechnicianId] of spec) {
    const email = `session-${name}-${Date.now()}-${Math.round(Math.random() * 1e6)}@session.test`;
    await registerUser(email);
    await assignRole(email, role, linkedTechnicianId);
    users[name] = { email, role, technicianId: linkedTechnicianId, token: await tokenFor(email) };
  }

  return users;
}
