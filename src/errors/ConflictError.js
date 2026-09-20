import { AppError } from './AppError.js';

// Конфликт данных: например, попытка создать запись, которая уже существует.
export class ConflictError extends AppError {
  constructor(message = 'Конфликт данных') {
    super(message, { status: 409, code: 'conflict' });
  }
}
