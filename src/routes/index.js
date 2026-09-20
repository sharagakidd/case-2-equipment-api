import { Router } from 'express';
import healthRouter from './health.js';
import equipmentRouter from './equipment.js';

// Корневой роутер API: сюда подключаются роутеры ресурсов (оборудование, прогноз погоды).
const router = Router();

router.use('/health', healthRouter);
router.use('/equipment', equipmentRouter);

export default router;
