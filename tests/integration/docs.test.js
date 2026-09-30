import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { app, request, sequelize, prepareTestDatabase } from './helpers/test-context.js';

beforeAll(() => prepareTestDatabase(), 60_000);
afterAll(() => sequelize.close());

describe('документация OpenAPI', () => {
  test('GET /api/docs отдаёт интерфейс Swagger UI', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Swagger UI');
  });

  test('GET /api/docs/ со слэшем отвечает тем же интерфейсом', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
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
