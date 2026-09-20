import { AppError } from './AppError.js';

// Ошибка валидации: превращает ZodError в плоский список проблем вида
// [{ field: 'city', message: '...' }], который удобно отдавать клиенту.
export class ValidationError extends AppError {
  constructor(zodError) {
    super('Ошибка валидации данных', {
      status: 422,
      code: 'validation_error',
      details: zodError.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
