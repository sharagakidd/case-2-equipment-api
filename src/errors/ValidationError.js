import { AppError } from './AppError.js';

// Ошибка валидации: принимает ZodError или готовый список проблем [{ field, message }].
export class ValidationError extends AppError {
  constructor(error, message = 'Ошибка валидации данных') {
    super(message, {
      status: 422,
      code: 'validation_error',
      details: toDetails(error),
    });
  }
}

function toDetails(error) {
  if (Array.isArray(error)) return error;

  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
  }));
}
