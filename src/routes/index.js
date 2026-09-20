import { Router } from 'express';
import healthRouter from './health.js';

// Корневой роутер API: сюда подключаются роутеры ресурсов (оборудование, прогноз погоды).
const router = Router();

router.use(healthRouter);

export default router;
