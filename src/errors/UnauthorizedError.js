import { AppError } from './AppError.js';

// 401: неверные учётные данные либо отсутствующий/просроченный токен.
export class UnauthorizedError extends AppError {
  constructor(message = 'Требуется аутентификация') {
    super(message, { status: 401, code: 'unauthorized' });
  }
}
