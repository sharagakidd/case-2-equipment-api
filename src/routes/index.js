import { Router } from 'express';
import healthRouter from './health.js';

// Корневой роутер API: сюда подключаются роутеры ресурсов (оборудование, прогноз погоды).
const router = Router();

router.use('/health', healthRouter);

export default router;
