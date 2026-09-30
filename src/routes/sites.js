import { Router } from 'express';
import { siteController } from '../controllers/siteController.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { idParamSchema } from '../validators/siteSchemas.js';

// Роутер площадок. Справочник в API не выведен, доступна только сводка по объекту.
const router = Router();

// Сводка доступна любому вошедшему пользователю.
router.use(authMiddleware);

/**
 * @openapi
 * /api/sites/{id}/summary:
 *   get:
 *     tags: [Sites]
 *     summary: Сводка по площадке
 *     description: >
 *       Агрегаты по объекту: сколько техники, заявок и в каких они статусах. Справочник
 *       площадок в API не выведен — доступна только сводка по известному идентификатору.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Сводка по площадке
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: object, description: Агрегаты площадки }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:id/summary', validate({ params: idParamSchema }), siteController.summary);

export default router;
