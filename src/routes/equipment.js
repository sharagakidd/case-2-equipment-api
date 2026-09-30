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

/**
 * @openapi
 * /api/equipment:
 *   get:
 *     tags: [Equipment]
 *     summary: Список оборудования
 *     description: >
 *       Постраничный список с фильтрами по статусу и типу. Чтение доступно любой
 *       вошедшей роли — viewer, technician и admin.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - $ref: '#/components/parameters/SortBy'
 *       - $ref: '#/components/parameters/Order'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [operational, maintenance, fault, decommissioned] }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [turbine, inverter, sensor, substation] }
 *     responses:
 *       200:
 *         description: Список оборудования с блоком meta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipmentListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', validate({ query: equipmentListQuery }), equipmentController.list);

/**
 * @openapi
 * /api/equipment:
 *   post:
 *     tags: [Equipment]
 *     summary: Добавить оборудование
 *     description: Только администратор. Ответ 201 и заголовок Location со ссылкой на запись.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EquipmentInput'
 *     responses:
 *       201:
 *         description: Оборудование создано
 *         headers:
 *           Location:
 *             description: Ссылка на созданную запись
 *             schema: { type: string, example: /api/equipment/3f1c9a2e-7c2b-4d5f-9a1e-2b6c8d4e0f11 }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipmentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Роль не admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Оборудование с таким serialNumber уже есть
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', requireRole('admin'), validate({ body: createEquipmentSchema }), equipmentController.create);
/**
 * @openapi
 * /api/equipment/{id}/requests:
 *   get:
 *     tags: [Equipment]
 *     summary: Заявки по оборудованию
 *     description: Список заявок конкретной единицы техники с теми же фильтрами, что у /api/requests.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [new, in_progress, done, rejected] }
 *       - name: priority
 *         in: query
 *         schema: { type: string, enum: [low, medium, high, critical] }
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
 *       404:
 *         description: Оборудование не найдено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:id/requests', validate({ query: requestListQuery }), requestController.getByEquipment);

/**
 * @openapi
 * /api/equipment/{id}/weather:
 *   get:
 *     tags: [Equipment]
 *     summary: Пригодность окна для наружных работ
 *     description: >
 *       Берёт координаты техники, запрашивает прогноз Open-Meteo на 3 дня и оценивает окно
 *       по осадкам и ветру. Недоступность внешнего API — не ошибка: 200, suitable: null и
 *       forecast.available: false.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Оценка окна (или признак недоступности прогноза)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/weather', equipmentController.getWeather);
router.get('/:id/weather', equipmentController.getWeather);
/**
 * @openapi
 * /api/equipment/{id}:
 *   get:
 *     tags: [Equipment]
 *     summary: Оборудование по идентификатору
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Карточка оборудования
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipmentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:id', validate({ params: idParamSchema }), equipmentController.getOne);

/**
 * @openapi
 * /api/equipment/{id}:
 *   patch:
 *     tags: [Equipment]
 *     summary: Изменить оборудование
 *     description: Только администратор. В теле можно передать любое подмножество полей.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Подмножество полей EquipmentInput
 *             properties:
 *               name: { type: string, minLength: 3, maxLength: 100 }
 *               type: { type: string, enum: [turbine, inverter, sensor, substation] }
 *               serialNumber: { type: string }
 *               status: { type: string, enum: [operational, maintenance, fault, decommissioned] }
 *               location:
 *                 type: object
 *                 properties:
 *                   lat: { type: number, minimum: -90, maximum: 90 }
 *                   lon: { type: number, minimum: -180, maximum: 180 }
 *               siteId: { type: string, format: uuid, nullable: true }
 *               installedAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Обновлённая карточка
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipmentResponse'
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
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.patch('/:id', requireRole('admin'), validate({ params: idParamSchema, body: updateEquipmentSchema }), equipmentController.update);

/**
 * @openapi
 * /api/equipment/{id}:
 *   delete:
 *     tags: [Equipment]
 *     summary: Удалить оборудование
 *     description: >
 *       Только администратор. Удаление мягкое: запись помечается deletedAt и пропадает
 *       из выборок. Если на технику ссылаются заявки — 409.
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
 *       409:
 *         description: На оборудование ссылаются заявки
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', requireRole('admin'), validate({ params: idParamSchema }), equipmentController.remove);

router.post('/', requireRole('admin'), validate({ body: createEquipmentSchema }), equipmentController.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParamSchema, body: updateEquipmentSchema }), equipmentController.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParamSchema }), equipmentController.remove);

export default router;

