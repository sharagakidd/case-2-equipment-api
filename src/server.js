import app from './app.js';
import { config } from './config/index.js';
import logger from './lib/logger.js';

const server = app.listen(config.port, () => {
  logger.info(`Сервер запущен на http://localhost:${config.port} (${config.nodeEnv})`);
});

// Корректное завершение: перестаём принимать новые соединения, ждём закрытия
// текущих и выходим с кодом 1. Страховочный таймер не даёт процессу зависнуть,
// если соединения так и не закроются (unref — чтобы он сам не держал event loop).
function shutdown(reason, err) {
  logger.fatal({ err, reason }, 'shutting down');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
process.on('unhandledRejection', (reason) => shutdown('unhandledRejection', reason));
