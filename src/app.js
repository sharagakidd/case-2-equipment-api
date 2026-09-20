import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { httpLogger } from './lib/http-logger.js';
import { contextMiddleware } from './lib/context.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import router from './routes/index.js';

// Сборка приложения: HTTP-логгер и контекст запроса идут первыми — они создают
// req.id/req.log, которые нужны остальным middleware и роутерам. Далее защита
// (helmet, CORS, лимит частоты), парсер JSON, роутер, а в конце notFound и
// единый обработчик ошибок — любой сбой отвечает в формате { error: {...} }.
const app = express();
app.use(httpLogger);
app.use(contextMiddleware);
// Безопасность: защитные заголовки, CORS по списку из окружения и лимит частоты.
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use('/api', router);
app.use(notFound);
app.use(errorHandler);

export default app;
