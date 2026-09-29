import { AppError } from './AppError.js';

// 403: доступ запрещён — токен недействителен (подпись, срок, формат) либо роли не хватает прав.
export class ForbiddenError extends AppError {
  constructor(message = 'Доступ запрещён') {
    super(message, { status: 403, code: 'forbidden' });
  }
}
