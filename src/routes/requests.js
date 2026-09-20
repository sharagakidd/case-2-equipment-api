import { Router } from 'express';
import { requestController } from '../controllers/requestController.js';
import { validate } from '../middlewares/validate.js';
import {
  createRequestSchema,
  updateRequestSchema,
  statusChangeSchema,
  idParamSchema,
} from '../validators/requestSchemas.js';
import { requestListQuery } from '../validators/querySchemas.js';

// Роутер ресурса «заявка». Монтируется по пути /requests, поэтому пути внутри
// указываются от него. Смена статуса вынесена в отдельный маршрут: через обычный
// PATCH статус не подменить, поэтому правила переходов обойти нельзя.
const router = Router();

router.get('/', validate({ query: requestListQuery }), requestController.list);
router.post('/', validate({ body: createRequestSchema }), requestController.create);
router.patch('/:id/status', validate({ params: idParamSchema, body: statusChangeSchema }), requestController.changeStatus);
router.get('/:id', validate({ params: idParamSchema }), requestController.getOne);
router.patch('/:id', validate({ params: idParamSchema, body: updateRequestSchema }), requestController.update);
router.delete('/:id', validate({ params: idParamSchema }), requestController.remove);

export default router;
