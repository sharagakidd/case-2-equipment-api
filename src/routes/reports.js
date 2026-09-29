import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { equipmentLoadQuery } from '../validators/reportSchemas.js';

// Роутер отчётов: только чтение, фильтры приходят query-параметрами.
const router = Router();

// Отчёт доступен любому вошедшему пользователю.
router.use(authMiddleware);

router.get('/equipment-load', validate({ query: equipmentLoadQuery }), reportController.equipmentLoad);

export default router;
