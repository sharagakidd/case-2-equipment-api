import { Router } from 'express';
import { equipmentController } from '../controllers/equipmentController.js';
import { validate } from '../middlewares/validate.js';
import { createEquipmentSchema, updateEquipmentSchema } from '../validators/equipmentSchemas.js';
import { equipmentListQuery } from '../validators/querySchemas.js';

// Роутер ресурса «оборудование». Монтируется в корневом роутере по пути /equipment,
// поэтому здесь пути указываются от него: GET /, GET /:id и так далее.
const router = Router();

router.get('/', validate({ query: equipmentListQuery }), equipmentController.list);
router.post('/', validate({ body: createEquipmentSchema }), equipmentController.create);
router.get('/:id', equipmentController.getOne);
router.patch('/:id', validate({ body: updateEquipmentSchema }), equipmentController.update);
router.delete('/:id', equipmentController.remove);

export default router;
