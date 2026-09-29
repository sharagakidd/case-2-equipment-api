import { Router } from 'express';
import { siteController } from '../controllers/siteController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { idParamSchema } from '../validators/siteSchemas.js';

// Роутер площадок. Справочник в API не выведен, доступна только сводка по объекту.
const router = Router();

// Сводка доступна любому вошедшему пользователю.
router.use(authMiddleware);

router.get('/:id/summary', validate({ params: idParamSchema }), siteController.summary);

export default router;
