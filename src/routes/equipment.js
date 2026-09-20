import { Router } from 'express';
import { equipmentController } from '../controllers/equipmentController.js';
import { requestController } from '../controllers/requestController.js';
import { validate } from '../middlewares/validate.js';
import { createEquipmentSchema, updateEquipmentSchema, idParamSchema } from '../validators/equipmentSchemas.js';
import { equipmentListQuery, requestListQuery } from '../validators/querySchemas.js';

// Роутер ресурса «оборудование». Монтируется в корневом роутере по пути /equipment,
// поэтому здесь пути указываются от него: GET /, GET /:id и так далее.
// Заявки по технике отдаём вложенным маршрутом /:id/requests.
const router = Router();

router.get('/', validate({ query: equipmentListQuery }), equipmentController.list);
router.post('/', validate({ body: createEquipmentSchema }), equipmentController.create);
router.get('/:id/requests', validate({ query: requestListQuery }), requestController.getByEquipment);
router.get('/:id/weather', equipmentController.getWeather);
router.get('/:id', validate({ params: idParamSchema }), equipmentController.getOne);
router.patch('/:id', validate({ params: idParamSchema, body: updateEquipmentSchema }), equipmentController.update);
router.delete('/:id', validate({ params: idParamSchema }), equipmentController.remove);

export default router;
