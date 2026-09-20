import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { ValidationError } from '../errors/ValidationError.js';
import logger from '../lib/logger.js';

// Соответствие «класс ошибки → машинный код» по ТЗ кейса. Всё, что не попало
// в таблицу (в том числе базовый AppError), отдаём как INTERNAL_ERROR.
const ERROR_CODES = [
  [NotFoundError, 'NOT_FOUND'],
  [ConflictError, 'CONFLICT'],
  [ValidationError, 'VALIDATION_ERROR'],
];

function resolveErrorCode(err) {
  const matched = ERROR_CODES.find(([ErrorType]) => err instanceof ErrorType);

  return matched ? matched[1] : 'INTERNAL_ERROR';
}

// Единый обработчик ошибок: тело ответа вида
// { error: { code, message, details?, requestId } }. Ожидаемые ошибки (AppError)
// отдаём клиенту как есть, а внутренние прячем — наружу уходит безликий 500,
// детали остаются только в логах.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status ?? 500;
  const log = req.log ?? logger;
  log[status >= 500 ? 'error' : 'warn']({ err, status }, 'request failed');

  const body = {
    error: {
      code: resolveErrorCode(err),
      message: status < 500 ? err.message : 'Внутренняя ошибка сервера',
      requestId: req.id,
    },
  };

  if (err.details) {
    body.error.details = err.details;
  }

  return res.status(status).json(body);
}
