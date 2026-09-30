import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validate } from '../middlewares/validate.js';
import { loginRateLimit } from '../middlewares/loginRateLimit.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

// Регистрация публичная, но создаёт только viewer: роли выдаёт админ,
// иначе любой зарегистрировался бы администратором.
const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Регистрация пользователя
 *     description: >
 *       Создаёт учётную запись с ролью viewer: повышать права может только администратор,
 *       поэтому поле role в теле игнорируется. Пароль сохраняется bcrypt-хешем и наружу не отдаётся.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Credentials'
 *     responses:
 *       201:
 *         description: Пользователь создан, роль viewer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       422:
 *         description: Тело не прошло валидацию (почта или длина пароля)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Пользователь с такой почтой уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', validate({ body: registerSchema }), authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Вход в систему
 *     description: >
 *       Проверяет учётные данные и возвращает access-токен в теле (живёт 15 минут),
 *       а refresh-токен (7 дней) кладёт в HttpOnly-cookie. Ответ на неверный пароль и на
 *       несуществующего пользователя одинаковый — перечислять почты нельзя.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Credentials'
 *     responses:
 *       200:
 *         description: Токен выдан, refresh-cookie установлена
 *         headers:
 *           Set-Cookie:
 *             description: refreshToken=...; HttpOnly; SameSite=Strict
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       422:
 *         description: Тело не прошло валидацию
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Неверный пароль или пользователя нет
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Превышен лимит попыток входа (5 за 15 минут с одного адреса)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', loginRateLimit, validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Перевыпуск access-токена
 *     description: >
 *       Refresh-токен читается из HttpOnly-cookie, тело не нужно. Возвращает новую пару:
 *       access-токен в теле и обновлённую refresh-cookie — старый refresh больше не действует.
 *       Пользователь перечитывается из базы, поэтому удалённый или понижённый в роли новый
 *       access не получит.
 *     security: []
 *     responses:
 *       200:
 *         description: Новая пара токенов
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Refresh-токен не передан, недействителен или пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', authController.refresh);

export default router;
