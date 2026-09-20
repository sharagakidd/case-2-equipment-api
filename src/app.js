import express from 'express';
import { httpLogger } from './lib/http-logger.js';
import { contextMiddleware } from './lib/context.js';
import router from './routes/index.js';

// Сборка приложения: HTTP-логгер и контекст запроса идут первыми — они создают
// req.id/req.log, которые нужны остальным middleware и роутерам.
const app = express();
app.use(httpLogger);
app.use(contextMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', router);

export default app;
