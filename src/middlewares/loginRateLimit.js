import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// Лимит на вход: 5 попыток за 15 минут с одного адреса. Считаем все обращения
// к эндпоинту — и успешные, и неуспешные.
export const loginRateLimit = rateLimit({
  windowMs: config.auth.loginRateLimit.windowMs,
  max: config.auth.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Свой ответ, чтобы 429 приходил в общем формате ошибок API.
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Слишком много попыток входа, попробуйте позже',
        requestId: req.id,
      },
    });
  },
});
