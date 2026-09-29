import jwt from 'jsonwebtoken';

// Время жизни токенов: короткий access и длинный refresh. Утёкший access живёт
// недолго, а refresh можно перевыпускать с ротацией.
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '7d';

// Имя cookie: клиент не должен путать долгоживущий refresh с access-токеном из тела.
export const REFRESH_COOKIE_NAME = 'refreshToken';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Секреты берём только из окружения: в репозитории их нет, в .env.example — одни имена.
// Разные секреты для access и refresh не дают подменить один токен другим.
function secret(name) {
  const value = process.env[name];

  if (!value) throw new Error(`Не задан ${name}: без секрета подписывать токены нельзя`);

  return value;
}

// В access-токене и почта, и роль: middleware прав читает роль без обращения к базе.
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret('JWT_ACCESS_SECRET'), {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

// В refresh-токене только идентификатор: он живёт долго и нужен лишь для перевыпуска.
export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, secret('JWT_REFRESH_SECRET'), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, secret('JWT_ACCESS_SECRET'));
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, secret('JWT_REFRESH_SECRET'));
}

// Флаги refresh-cookie: httpOnly — токен не видит JS, secure — только HTTPS,
// sameSite strict — cookie не уходит с чужих сайтов.
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}
