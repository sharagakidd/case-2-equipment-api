import { USER_ROLES } from '../db/models/user.js';
import { ForbiddenError } from '../errors/ForbiddenError.js';

// requireRole('admin', 'technician') пропускает только эти роли.
// Роль берём из req.user, который заполнил authenticate.
export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0) {
    // Иначе маршрут молча закрылся бы для всех: такую опечатку лучше поймать на старте.
    throw new Error('requireRole: не передано ни одной роли');
  }

  const unknownRoles = allowedRoles.filter((role) => !USER_ROLES.includes(role));
  if (unknownRoles.length > 0) {
    throw new Error(`requireRole: неизвестные роли: ${unknownRoles.join(', ')}`);
  }

  return function checkRole(req, res, next) {
    // req.user может отсутствовать, если authenticate не подключён к маршруту:
    // закрываем доступ, а не пропускаем запрос «по умолчанию».
    const role = req.user?.role;

    if (!allowedRoles.includes(role)) {
      return next(new ForbiddenError(`Недостаточно прав: требуется роль ${allowedRoles.join(' или ')}`));
    }

    return next();
  };
}
