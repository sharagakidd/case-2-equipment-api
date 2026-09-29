import { Router } from 'express';
import { equipmentController } from '../controllers/equipmentController.js';
import { requestController } from '../controllers/requestController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { createEquipmentSchema, updateEquipmentSchema, idParamSchema } from '../validators/equipmentSchemas.js';
import { equipmentListQuery, requestListQuery } from '../validators/querySchemas.js';

// Роутер оборудования (монтируется по пути /equipment). Чтение доступно любому
// вошедшему пользователю, изменение справочника — только администратору.
const router = Router();

router.use(authMiddleware);

router.get('/', validate({ query: equipmentListQuery }), equipmentController.list);
router.get('/:id/requests', validate({ query: requestListQuery }), requestController.getByEquipment);
router.get('/:id/weather', equipmentController.getWeather);
router.get('/:id', validate({ params: idParamSchema }), equipmentController.getOne);

router.post('/', requireRole('admin'), validate({ body: createEquipmentSchema }), equipmentController.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParamSchema, body: updateEquipmentSchema }), equipmentController.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParamSchema }), equipmentController.remove);

export default router;

