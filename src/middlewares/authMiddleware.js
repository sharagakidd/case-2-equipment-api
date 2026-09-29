import { verifyAccessToken } from '../lib/tokens.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { ForbiddenError } from '../errors/ForbiddenError.js';

// Из заголовка берём только схему Bearer: другой формат считаем отсутствием токена.
function extractToken(header) {
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.trim().split(' ');

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

// Проверяем access-токен и кладём в req.user его идентификатор и роль.
// Нет токена — 401, токен не прошёл проверку — 403.
export function authMiddleware(req, res, next) {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return next(new UnauthorizedError('Требуется access-токен в заголовке Authorization: Bearer <token>'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    // Причину (истёк, подпись, формат) наружу не расшифровываем: это подсказка атакующему.
    return next(new ForbiddenError('Токен недействителен или истёк'));
  }

  req.user = { userId: payload.sub, role: payload.role };

  return next();
}
