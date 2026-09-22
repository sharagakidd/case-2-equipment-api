import { Router } from 'express';

// Health-проверка: только «процесс жив», без обращений к внешним API.
// Смонтирован в app.js как app.use('/api', router), поэтому итоговый путь — /api/health.
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

export default router;
