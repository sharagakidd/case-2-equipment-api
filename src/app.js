import express from 'express';
import { httpLogger } from './lib/http-logger.js';
import { contextMiddleware } from './lib/context.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import router from './routes/index.js';

// Сборка приложения: HTTP-логгер и контекст запроса идут первыми — они создают
// req.id/req.log, которые нужны остальным middleware и роутерам.
// В конце — notFound и единый обработчик ошибок, поэтому любой сбой отвечает
// в формате RFC 9457 и логируется с requestId.
const app = express();
app.use(httpLogger);
app.use(contextMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', router);
app.use(notFound);
app.use(errorHandler);

export default app;
