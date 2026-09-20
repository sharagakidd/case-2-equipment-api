import { AppError } from './AppError.js';

// «Не найдено»: отсутствующая техника, город, запись в хранилище.
export class NotFoundError extends AppError {
  constructor(what = 'Ресурс') {
    super(`${what} не найден`, { status: 404, code: 'not_found' });
  }
}
