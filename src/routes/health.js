import { Router } from 'express';
import { readFileSync } from 'node:fs';

// Health-проверка для мониторинга: отвечает быстро и без обращения к внешним API.
// version читаем из package.json, uptime — время жизни процесса в секундах.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: pkg.version,
  });
});

export default router;
