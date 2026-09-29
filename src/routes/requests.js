import { Router } from 'express';
import { requestController } from '../controllers/requestController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  createRequestSchema,
  updateRequestSchema,
  statusChangeSchema,
  assignTeamSchema,
  assigneeParamsSchema,
  idParamSchema,
} from '../validators/requestSchemas.js';
import { requestListQuery } from '../validators/querySchemas.js';

// Роутер заявок (монтируется по пути /requests). Чтение доступно любому вошедшему
// пользователю, работу с заявками ведут technician и admin, бригаду назначает admin.
const router = Router();

router.use(authMiddleware);

router.get('/', validate({ query: requestListQuery }), requestController.list);
router.get('/:id/history', validate({ params: idParamSchema }), requestController.history);
router.get('/:id', validate({ params: idParamSchema }), requestController.getOne);

router.post('/', requireRole('technician', 'admin'), validate({ body: createRequestSchema }), requestController.create);
router.patch('/:id', requireRole('technician', 'admin'), validate({ params: idParamSchema, body: updateRequestSchema }), requestController.update);
router.patch('/:id/status', requireRole('technician', 'admin'), validate({ params: idParamSchema, body: statusChangeSchema }), requestController.changeStatus);
// Бригада вынесена в отдельный подресурс: PATCH заявки её не касается.
router.post('/:id/assignees', requireRole('admin'), validate({ params: idParamSchema, body: assignTeamSchema }), requestController.assignTeam);
router.delete('/:id/assignees/:userId', requireRole('admin'), validate({ params: assigneeParamsSchema }), requestController.removeAssignee);
router.delete('/:id', requireRole('admin'), validate({ params: idParamSchema }), requestController.remove);

export default router;

