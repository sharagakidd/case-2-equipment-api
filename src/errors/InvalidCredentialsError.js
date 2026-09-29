import { AppError } from './AppError.js';

// 401 на неуспешный вход. Текст один и тот же для несуществующего пользователя
// и неверного пароля: иначе по ответу узнают, какие почты зарегистрированы.
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Неверные учетные данные', { status: 401, code: 'invalid_credentials' });

    // requestId не отдаём: тела ответов на оба случая должны совпадать.
    this.hideRequestId = true;
  }
}
