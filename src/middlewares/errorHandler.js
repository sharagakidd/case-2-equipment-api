import { UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { ValidationError } from '../errors/ValidationError.js';
import { isReferenceViolation } from '../repositories/BaseRepository.js';
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

// Запрет удаления и вставки из-за связанных данных: код драйвера 23001 (ON DELETE RESTRICT)
// Sequelize не превращает в ForeignKeyConstraintError, поэтому распознаём его отдельно.
// Для DELETE это конфликт, для записи — ошибка переданной ссылки.
const REFERENCE_ERRORS = {
  DELETE: {
    status: 409,
    code: 'CONFLICT',
    message: 'Нельзя удалить запись: на неё ссылаются другие данные',
  },
  default: {
    status: 422,
    code: 'VALIDATION_ERROR',
    message: 'Указана ссылка на несуществующую связанную запись',
  },
};

function resolveErrorCode(err) {
  const matched = ERROR_CODES.find(([ErrorType]) => err instanceof ErrorType);

  return matched ? matched[1] : 'INTERNAL_ERROR';
}

// Ошибку базы узнаём по классу: у неё нет ни status, ни нашего кода.
function resolveDbError(err, method) {
  const matched = DB_ERRORS.find(([ErrorType]) => err instanceof ErrorType);
  if (matched) return matched[1];
  if (isReferenceViolation(err)) return REFERENCE_ERRORS[method] ?? REFERENCE_ERRORS.default;

  return null;
}

// Тело ответа: { error: { code, message, details?, requestId } }. Ожидаемые ошибки
// отдаём как есть, ошибки базы — по таблице выше, внутренние прячем под 500.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const dbError = resolveDbError(err, req.method);
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
