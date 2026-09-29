import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  app,
  request,
  sequelize,
  prepareTestDatabase,
  cleanupTestData,
  registerUser,
  login,
  uniqueEmail,
  PASSWORD,
} from './helpers/test-context.js';

beforeAll(() => prepareTestDatabase(), 60_000);
beforeEach(() => cleanupTestData(), 30_000);
afterAll(() => sequelize.close());

describe('POST /api/auth/register', () => {
  test('создаёт пользователя с ролью viewer и не отдаёт хеш пароля', async () => {
    const email = uniqueEmail();

    const res = await registerUser(email);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email, role: 'viewer' });
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Passw0rd');
  });

  test('роль из тела игнорируется: самовольно стать админом нельзя', async () => {
    const email = uniqueEmail();

    const res = await registerUser(email, PASSWORD, { role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('viewer');

    const [rows] = await sequelize.query('SELECT role FROM users WHERE email = :email', {
      replacements: { email },
    });
    expect(rows[0].role).toBe('viewer');
  });

  test('пароль хранится хешем, а не текстом', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const [rows] = await sequelize.query('SELECT password_hash FROM users WHERE email = :email', {
      replacements: { email },
    });

    expect(rows[0].password_hash).not.toBe(PASSWORD);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  test('повторная регистрация той же почты → 409 «conflict»', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await registerUser(email);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('короткий пароль → 422 с указанием поля', async () => {
    const res = await registerUser(uniqueEmail(), 'short');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('password');
  });

  test('некорректная почта → 422', async () => {
    const res = await registerUser('not-an-email');

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('email');
  });

  test('лишние поля в теле не сохраняются', async () => {
    const email = uniqueEmail();

    const res = await registerUser(email, PASSWORD, { technicianId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(201);

    const [rows] = await sequelize.query('SELECT technician_id FROM users WHERE email = :email', {
      replacements: { email },
    });
    expect(rows[0].technician_id).toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  test('верные данные → accessToken и refresh в HttpOnly cookie', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await login(email);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user).toMatchObject({ email, role: 'viewer' });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite/i);
  });

  test('почта сверяется без учёта регистра', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await login(email.toUpperCase());

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
  });

  test('неверный пароль → 401', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await login(email, 'WrongPassword1');

    expect(res.status).toBe(401);
  });

  test('несуществующий пользователь получает тот же ответ, что и при неверном пароле', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const wrongPassword = await login(email, 'WrongPassword1');
    const noSuchUser = await login(uniqueEmail(), 'WrongPassword1');

    expect(noSuchUser.status).toBe(401);
    expect(noSuchUser.body.error.message).toBe(wrongPassword.body.error.message);
  });

  test('без тела → 422', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(422);
  });
});
