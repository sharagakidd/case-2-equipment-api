import { Router } from 'express';
import { sequelize } from '../db/index.js';

// Проверки живости: путь получается /api/health (роутер смонтирован в app.js под /api).
const router = Router();

const startedAt = Date.now();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Service]
 *     summary: Состояние сервиса
 *     description: Uptime, версия и время ответа. Базу не трогает, токен не нужен.
 *     security: []
 *     responses:
 *       200:
 *         description: Сервис запущен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptime: { type: integer, description: Секунды с момента запуска }
 *                 version: { type: string, example: 1.0.0 }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /api/health/live:
 *   get:
 *     tags: [Service]
 *     summary: Живость процесса (liveness)
 *     description: >
 *       Отвечает 200, пока процесс жив; базу не проверяет — именно на этот эндпоинт
 *       смотрит healthcheck приложения в compose.
 *     security: []
 *     responses:
 *       200:
 *         description: Процесс жив
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 */
// Liveness: процесс жив, базу не трогаем — такой проверке верит healthcheck в compose.
router.get('/live', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /api/health/ready:
 *   get:
 *     tags: [Service]
 *     summary: Готовность к обслуживанию (readiness)
 *     description: >
 *       Проверяет доступность базы: при недоступной БД отвечает 503 с database: down,
 *       а не падает молча.
 *     security: []
 *     responses:
 *       200:
 *         description: Приложение готово, база доступна
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *       503:
 *         description: База недоступна
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 */
// Readiness: приложение готово работать, только если доступна база.
router.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

export default router;

