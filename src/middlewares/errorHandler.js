import logger from '../lib/logger.js';

// Единый обработчик ошибок: отвечает в формате RFC 9457 (Problem Details).
// Ожидаемые ошибки (AppError) отдаём клиенту как есть, а внутренние прячем —
// наружу уходит безликий 500, детали остаются только в логах.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status ?? 500;
  const log = req.log ?? logger;
  log[status >= 500 ? 'error' : 'warn']({ err, status }, 'request failed');

  const body = {
    type: `https://equipment-api.local/problems/${err.code ?? 'internal-error'}`,
    title: status < 500 ? err.message : 'Внутренняя ошибка сервера',
    status,
    instance: req.originalUrl,
    requestId: req.id,
  };

  if (err.details) {
    body.errors = err.details;
  }

  return res.status(status).type('application/problem+json').json(body);
}
