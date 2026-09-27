import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { validate } from '../middlewares/validate.js';
import { equipmentLoadQuery } from '../validators/reportSchemas.js';

// Роутер отчётов: только чтение, фильтры приходят query-параметрами.
const router = Router();

router.get('/equipment-load', validate({ query: equipmentLoadQuery }), reportController.equipmentLoad);

export default router;
