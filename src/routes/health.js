import { Router } from 'express';
import { sequelize } from '../db/index.js';

// Проверки живости: путь получается /api/health (роутер смонтирован в app.js под /api).
const router = Router();

const startedAt = Date.now();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Liveness: процесс жив, базу не трогаем — такой проверке верит healthcheck в compose.
router.get('/live', (req, res) => {
  res.json({ status: 'ok' });
});

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

