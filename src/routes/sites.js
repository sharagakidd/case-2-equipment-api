import { Router } from 'express';
import { siteController } from '../controllers/siteController.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/siteSchemas.js';

// Роутер площадок. Справочник в API не выведен, доступна только сводка по объекту.
const router = Router();

router.get('/:id/summary', validate({ params: idParamSchema }), siteController.summary);

export default router;
