import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { equipmentLoadQuery } from '../validators/reportSchemas.js';

// Роутер отчётов: только чтение, фильтры приходят query-параметрами.
const router = Router();

// Отчёт доступен любому вошедшему пользователю.
router.use(authMiddleware);

/**
 * @openapi
 * /api/reports/equipment-load:
 *   get:
 *     tags: [Reports]
 *     summary: Отчёт по загрузке оборудования
 *     description: >
 *       Число заявок на каждую единицу техники и их распределение по статусам.
 *       Без siteId отчёт считается по всем площадкам, с ним — по одной.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: siteId
 *         in: query
 *         description: Ограничить отчёт одной площадкой
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Строки отчёта
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { type: object, description: Оборудование и счётчики заявок }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/equipment-load', validate({ query: equipmentLoadQuery }), reportController.equipmentLoad);

export default router;
