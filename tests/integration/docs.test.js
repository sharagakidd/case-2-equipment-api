import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { app, request, sequelize, prepareTestDatabase } from './helpers/test-context.js';

beforeAll(() => prepareTestDatabase(), 60_000);
afterAll(() => sequelize.close());

describe('документация OpenAPI', () => {
  test('GET /api/docs перенаправляет на /api/docs/', async () => {
    const res = await request(app).get('/api/docs');

    // Без слэша браузер ищет ресурсы страницы по путям вида /api/swagger-ui.css и получает 404,
    // поэтому интерфейс остаётся пустым. Редирект это лечит.
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api/docs/');
  });

  test('GET /api/docs/ отдаёт интерфейс Swagger UI', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Swagger UI');
  });

  test('ресурсы интерфейса отдаются по адресам внутри /api/docs/', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-bundle.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
  });

  test('спецификация собирается из аннотаций роутов и содержит схему авторизации', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-init.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('openapi');
    expect(res.text).toContain('bearerAuth');
    expect(res.text).toContain('/api/auth/login');
    expect(res.text).toContain('/api/requests/{id}/status');
  });

  test('документация не перехватывает посторонние пути: /api/docs-nope → 404', async () => {
    const res = await request(app).get('/api/docs-nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
