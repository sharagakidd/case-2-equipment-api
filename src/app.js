import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { httpLogger } from './lib/http-logger.js';
import { contextMiddleware } from './lib/context.js';
import { httpMetricsMiddleware } from './lib/metrics.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import router from './routes/index.js';
import metricsRouter from './routes/metrics.js';

// Сборка приложения: сначала логгер и контекст запроса, затем защита, роутер
// и единый обработчик ошибок — любой сбой отвечает в формате { error: {...} }.
const app = express();

// За обратным прокси реальный адрес клиента приходит в X-Forwarded-For:
// без этого лимиты и логи видят только адрес nginx.
app.set('trust proxy', 1);

app.use(httpLogger);
app.use(contextMiddleware);
// Метрики собираем до лимита частоты — тогда 429 тоже попадают в счётчики.
app.use(httpMetricsMiddleware);
// Безопасность: защитные заголовки, CORS по списку из окружения и лимит частоты.
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    // Свой ответ, чтобы 429 приходил в общем формате ошибок API.
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Слишком много запросов, попробуйте позже',
          requestId: req.id,
        },
      });
    },
  }),
);
// Cookie нужны refresh-токену: парсер ставим до роутеров, чтобы req.cookies был доступен.
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use('/api', router);
app.use('/metrics', metricsRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
