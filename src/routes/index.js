import { Router } from 'express';
import healthRouter from './health.js';
import equipmentRouter from './equipment.js';
import requestsRouter from './requests.js';

// Корневой роутер API: сюда подключаются роутеры ресурсов (оборудование, заявки, прогноз погоды).
const router = Router();

router.use('/health', healthRouter);
router.use('/equipment', equipmentRouter);
router.use('/requests', requestsRouter);

export default router;
