import { Router } from 'express';
import healthRouter from './health.js';
import equipmentRouter from './equipment.js';
import requestsRouter from './requests.js';
import sitesRouter from './sites.js';
import reportsRouter from './reports.js';

// Корневой роутер API: сюда подключаются роутеры ресурсов (оборудование, заявки, площадки, отчёты).
const router = Router();

router.use('/health', healthRouter);
router.use('/equipment', equipmentRouter);
router.use('/requests', requestsRouter);
router.use('/sites', sitesRouter);
router.use('/reports', reportsRouter);

export default router;
