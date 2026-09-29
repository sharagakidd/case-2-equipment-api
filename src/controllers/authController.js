import { authService } from '../services/authService.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { sendOne } from '../utils/response.js';
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens.js';

// HTTP-слой аутентификации. Access-токен уходит в теле ответа (его клиент держит
// в памяти), refresh-токен — только в HttpOnly cookie, поэтому JS его не читает.
export const authController = {
  // Регистрация: 201 и карточка пользователя без пароля; токены выдаёт login.
  register: async (req, res) => {
    const { email, password, role } = req.valid.body;
    const user = await authService.register(email, password, role ?? 'viewer');

    res.status(201).json({ data: user });
  },

  // Вход: accessToken на 15 минут в теле, refreshToken на 7 дней в HttpOnly cookie.
  login: async (req, res) => {
    const { email, password } = req.valid.body;
    const user = await authService.login(email, password);

    res.cookie(REFRESH_COOKIE_NAME, signRefreshToken(user), refreshCookieOptions());
    sendOne(res, { user, accessToken: signAccessToken(user) });
  },

  // Перевыпуск пары: проверяем refresh из cookie и выдаём новый accessToken.
  // Refresh тоже перевыпускаем — ротация не даёт использовать старый повторно.
  refresh: async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new UnauthorizedError('Refresh-токен не передан');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Refresh-токен недействителен или истёк');
    }

    // Пользователя перечитываем из базы: удалённый или понижённый в роли
    // не должен получить новый access по старому refresh.
    const user = await authService.getById(payload.sub);
    if (!user) throw new UnauthorizedError('Пользователь не найден');

    res.cookie(REFRESH_COOKIE_NAME, signRefreshToken(user), refreshCookieOptions());
    sendOne(res, { user, accessToken: signAccessToken(user) });
  },
};
