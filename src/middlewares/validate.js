import { ValidationError } from '../errors/ValidationError.js';

// Валидация частей запроса по переданным схемам. Результат кладём в req.valid,
// а не обратно в req.query: в Express 5 query — геттер, присваивание сломается.
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = {};

    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue;

      const result = schemas[part].safeParse(req[part]);
      if (!result.success) {
        return next(new ValidationError(result.error));
      }
      req.valid[part] = result.data;
    }

    next();
  };
}
