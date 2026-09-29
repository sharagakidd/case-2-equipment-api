import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validate } from '../middlewares/validate.js';
import { loginRateLimit } from '../middlewares/loginRateLimit.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

// Регистрация публичная, но создаёт только viewer: роли выдаёт админ,
// иначе любой зарегистрировался бы администратором.
const router = Router();

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/login', loginRateLimit, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);

export default router;
