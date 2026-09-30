import app from './app.js';
import { config } from './config/index.js';
import { sequelize } from './db/index.js';
import logger from './lib/logger.js';
import { startBusinessMetrics } from './lib/business-metrics.js';

const server = app.listen(config.port, () => {
  logger.info(`Сервер запущен на http://localhost:${config.port} (${config.nodeEnv})`);
});

startBusinessMetrics();

// Корректное завершение в два шага: сначала перестаём принимать новые соединения
// и ждём закрытия текущих запросов, затем закрываем пул соединений с БД. Наоборот
// нельзя — запросы в работе обратились бы к уже закрытой базе. Код возврата: 0 для
// сигналов (штатное завершение) и 1 для падений. Страховочный таймер не даёт
// процессу зависнуть, если соединения не закроются (unref — чтобы он не держал loop).
async function shutdown({ reason, err, exitCode }) {
  if (exitCode === 0) {
    logger.info({ reason }, 'shutting down');
  } else {
    logger.fatal({ err, reason }, 'shutting down');
  }

  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('DB connections closed');
      process.exit(exitCode);
    } catch (closeError) {
      logger.error({ err: closeError }, 'не удалось закрыть соединения с БД');
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown({ reason: 'SIGTERM', exitCode: 0 }));
process.on('SIGINT', () => shutdown({ reason: 'SIGINT', exitCode: 0 }));
process.on('uncaughtException', (err) => shutdown({ reason: 'uncaughtException', err, exitCode: 1 }));
process.on('unhandledRejection', (err) => shutdown({ reason: 'unhandledRejection', err, exitCode: 1 }));
