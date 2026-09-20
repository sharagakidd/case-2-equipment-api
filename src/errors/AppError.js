// Базовая ошибка приложения: несёт HTTP-статус, машинный код и детали для ответа клиенту.
// Наследники (например, ValidationError) задают свои status/code, а name берётся
// из имени класса через new.target, чтобы в логах не приходилось угадывать тип ошибки.
export class AppError extends Error {
  constructor(message, { status = 500, code = 'internal_error', details, cause } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
