import { Router } from 'express';
import { metricsHandler } from '../lib/metrics.js';

const router = Router();

/**
 * @openapi
 * /metrics:
 *   get:
 *     tags: [Service]
 *     summary: Метрики Prometheus
 *     description: >
 *       Текстовый формат Prometheus: счётчики запросов и ошибок, гистограмма длительности,
 *       прикладные метрики из БД (заявки, загрузка техники) и метрики процесса Node.
 *       Наружу не публикуется: Prometheus обращается к нему по внутренней сети compose.
 *     security: []
 *     responses:
 *       200:
 *         description: Метрики в текстовом формате exposition
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: http_requests_total{method="GET",route="/api/health/live",status_code="200"} 1
 */
router.get('/', metricsHandler);

export default router;
