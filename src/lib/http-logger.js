import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import logger from './logger.js';

// HTTP-логирование запросов: id берём из заголовка X-Request-Id, если клиент его
// прислал (удобно склеивать логи фронта и бэка), иначе генерируем свой и
// возвращаем в ответе — по нему потом легко найти все логи конкретного запроса.
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    if (existing) return existing;
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps: (req) => ({ reqId: req.id }),
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
});
