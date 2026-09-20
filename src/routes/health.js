import { Router } from 'express';

// Health-проверка: только «процесс жив», без обращений к внешним API.
// Монтируется как /health, поэтому итоговый путь — /api/v1/health.
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
