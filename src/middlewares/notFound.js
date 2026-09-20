import { NotFoundError } from '../errors/NotFoundError.js';

// Подключается последним: превращает любой необработанный маршрут в AppError,
// чтобы 404 шёл через общий обработчик ошибок, а не отвечался express'ом по-своему.
export const notFound = (req, res, next) => next(new NotFoundError('Эндпоинт'));
