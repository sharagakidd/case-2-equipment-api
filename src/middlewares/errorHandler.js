import { UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { ValidationError } from '../errors/ValidationError.js';
import logger from '../lib/logger.js';

// Соответствие «класс ошибки → машинный код». Всё, что не попало в таблицу
// (в том числе базовый AppError), отдаём как INTERNAL_ERROR.
const ERROR_CODES = [
  [NotFoundError, 'NOT_FOUND'],
  [ConflictError, 'CONFLICT'],
  [ValidationError, 'VALIDATION_ERROR'],
];

// Ошибки приходят из базы, а не нашими классами, поэтому статус и текст задаём здесь.
// Наружу отдаём понятную формулировку — без имён таблиц и названий ограничений.
const DB_ERRORS = [
  [
    UniqueConstraintError,
    { status: 409, code: 'CONFLICT', message: 'Запись с таким значением уже существует' },
  ],
  [
    ForeignKeyConstraintError,
    {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Указана ссылка на несуществующую связанную запись',
    },
  ],
];

function resolveErrorCode(err) {
  const matched = ERROR_CODES.find(([ErrorType]) => err instanceof ErrorType);

  return matched ? matched[1] : 'INTERNAL_ERROR';
}

// Ошибку базы узнаём по классу: у неё нет ни status, ни нашего кода.
function resolveDbError(err) {
  const matched = DB_ERRORS.find(([ErrorType]) => err instanceof ErrorType);

  return matched ? matched[1] : null;
}

// Тело ответа: { error: { code, message, details?, requestId } }. Ожидаемые ошибки
// отдаём как есть, ошибки базы — по таблице выше, внутренние прячем под 500.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const dbError = resolveDbError(err);
  const status = dbError?.status ?? err.status ?? 500;
  const log = req.log ?? logger;
  log[status >= 500 ? 'error' : 'warn']({ err, status }, 'request failed');

  const body = {
    error: {
      code: dbError?.code ?? resolveErrorCode(err),
      message: dbError?.message ?? (status < 500 ? err.message : 'Внутренняя ошибка сервера'),
      requestId: req.id,
    },
  };

  if (err.details) {
    body.error.details = err.details;
  }

  return res.status(status).json(body);
}
