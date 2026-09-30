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

/**
 * @openapi
 * /api/requests:
 *   get:
 *     tags: [Requests]
 *     summary: Список заявок
 *     description: Постраничный список с фильтрами по статусу, приоритету и оборудованию.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - $ref: '#/components/parameters/SortBy'
 *       - $ref: '#/components/parameters/Order'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [new, in_progress, done, rejected] }
 *       - name: priority
 *         in: query
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *       - name: equipmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Список заявок с блоком meta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', validate({ query: requestListQuery }), requestController.list);

/**
 * @openapi
 * /api/requests:
 *   post:
 *     tags: [Requests]
 *     summary: Создать заявку
 *     description: Доступно technician и admin. Новая заявка всегда создаётся в статусе new.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestInput'
 *     responses:
 *       201:
 *         description: Заявка создана
 *         headers:
 *           Location:
 *             description: Ссылка на созданную заявку
 *             schema: { type: string, example: /api/requests/3f1c9a2e-7c2b-4d5f-9a1e-2b6c8d4e0f11 }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Роль viewer заявки создавать не может
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Указанного оборудования нет
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', requireRole('technician', 'admin'), validate({ body: createRequestSchema }), requestController.create);
/**
 * @openapi
 * /api/requests/{id}:
 *   get:
 *     tags: [Requests]
 *     summary: Заявка по идентификатору
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Карточка заявки
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:id', validate({ params: idParamSchema }), requestController.getOne);

/**
 * @openapi
 * /api/requests/{id}/history:
 *   get:
 *     tags: [Requests]
 *     summary: История статусов заявки
 *     description: Записи о переходах в порядке добавления; автор — почта вошедшего пользователя.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Массив записей истории
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       oldStatus: { type: string, nullable: true, enum: [new, in_progress, done, rejected] }
 *                       newStatus: { type: string, enum: [new, in_progress, done, rejected] }
 *                       author: { type: string, nullable: true }
 *                       comment: { type: string, nullable: true }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/history', validate({ params: idParamSchema }), requestController.history);

/**
 * @openapi
 * /api/requests/{id}:
 *   patch:
 *     tags: [Requests]
 *     summary: Изменить заявку
 *     description: >
 *       Доступно technician и admin. В теле — любое подмножество полей, кроме статуса:
 *       статус меняется отдельным эндпоинтом и только по разрешённым переходам.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Подмножество полей RequestInput
 *             properties:
 *               title: { type: string, minLength: 5, maxLength: 120 }
 *               description: { type: string, maxLength: 2000 }
 *               priority: { type: string, enum: [low, medium, high, critical] }
 *               plannedAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Обновлённая заявка
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.patch('/:id', requireRole('technician', 'admin'), validate({ params: idParamSchema, body: updateRequestSchema }), requestController.update);

/**
 * @openapi
 * /api/requests/{id}/status:
 *   patch:
 *     tags: [Requests]
 *     summary: Сменить статус заявки
 *     description: >
 *       Разрешённые переходы: new → in_progress (только если назначены исполнители) или
 *       rejected; in_progress → done или rejected. Статусы done и rejected конечные.
 *       Администратор меняет статус любой заявки, специалист — только той, куда назначен.
 *       Переходы пишутся в историю с автором из токена.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [new, in_progress, done, rejected] }
 *               author: { type: string, maxLength: 120, description: "Игнорируется: автором перехода становится вошедший пользователь" }
 *     responses:
 *       200:
 *         description: Статус изменён, запись добавлена в историю
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Специалист не назначен в эту заявку
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Переход запрещён или в заявке нет исполнителей
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.patch('/:id/status', requireRole('technician', 'admin'), validate({ params: idParamSchema, body: statusChangeSchema }), requestController.changeStatus);
// Бригада вынесена в отдельный подресурс: PATCH заявки её не касается.
/**
 * @openapi
 * /api/requests/{id}/assignees:
 *   post:
 *     tags: [Requests]
 *     summary: Назначить бригаду
 *     description: >
 *       Только admin. Состав заменяется целиком: в бригаде должен быть ровно один
 *       специалист с ролью lead, повторяющиеся technicianId запрещены. Ответ 201.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignees]
 *             properties:
 *               assignees:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   $ref: '#/components/schemas/Assignee'
 *     responses:
 *       201:
 *         description: Бригада назначена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RequestResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Роль не admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Заявка или техник не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Некорректный состав бригады (не один lead, дубли)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/assignees', requireRole('admin'), validate({ params: idParamSchema, body: assignTeamSchema }), requestController.assignTeam);

/**
 * @openapi
 * /api/requests/{id}/assignees/{userId}:
 *   delete:
 *     tags: [Requests]
 *     summary: Снять исполнителя с заявки
 *     description: Только admin. Идентификатор — id техника из справочника.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *       - name: userId
 *         in: path
 *         required: true
 *         description: Идентификатор техника
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Исполнитель снят, тела нет
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Роль не admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Заявка или исполнитель не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id/assignees/:userId', requireRole('admin'), validate({ params: assigneeParamsSchema }), requestController.removeAssignee);

/**
 * @openapi
 * /api/requests/{id}:
 *   delete:
 *     tags: [Requests]
 *     summary: Удалить заявку
 *     description: Только admin. История и назначения удаляются каскадом.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       204:
 *         description: Удалено, тела нет
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Роль не admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', requireRole('admin'), validate({ params: idParamSchema }), requestController.remove);

export default router;

