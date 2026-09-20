import pino from 'pino';
import { config } from '../config/index.js';

// Логгер приложения: в development включаем pino-pretty для читаемого вывода,
// в остальных окружениях пишем обычный JSON (его проще собирать и парсить).
const logger = pino({
  level: config.logLevel,
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    // '*' покрывает только один уровень вложенности, поэтому для плоских полей
    // (logger.info({ password, token })) нужны пути без подстановки.
    'password',
    '*.password',
    'token',
    '*.token',
  ],
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export default logger;
