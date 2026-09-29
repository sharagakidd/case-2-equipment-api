import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/index.js';
import { USER_ROLES } from '../db/models/user.js';
import { ConflictError } from '../errors/ConflictError.js';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError.js';
import { ValidationError } from '../errors/ValidationError.js';

// Стоимость хеширования: 10 раундов. bcrypt сам генерирует случайную соль на каждый
// хеш и хранит её рядом с ним, поэтому одинаковые пароли дают разные значения.
const SALT_ROUNDS = 10;

// Текст и код ответа на неуспешный вход задаёт InvalidCredentialsError: он один
// и тот же и для несуществующего пользователя, и для неверного пароля.

// Почта — ключ входа, поэтому храним и ищем её в нижнем регистре.
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Аутентификация: регистрация и проверка учётных данных. Хеш пароля не покидает
// этот модуль — наружу уходят только безопасные представления из репозитория.
export const authService = {
  // Роль по умолчанию — viewer: повышать права может только администратор.
  async register(email, password, role = 'viewer') {
    if (!USER_ROLES.includes(role)) {
      throw new ValidationError(
        [{ field: 'role', message: `Роль должна быть одной из: ${USER_ROLES.join(', ')}` }],
        'Некорректная роль пользователя',
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Быстрый путь: понятный конфликт вместо ошибки уникального индекса.
    // Индекс users_email_unique_idx остаётся второй линией защиты от гонок.
    if (await userRepository.existsByEmail(normalizedEmail)) {
      throw new ConflictError('Пользователь с такой почтой уже существует');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    return userRepository.create({ email: normalizedEmail, passwordHash, role });
  },

  // Вход возвращает только безопасные поля: id, email, role (+ время создания).
  async login(email, password) {
    const credentials = await userRepository.findCredentialsByEmail(normalizeEmail(email));
    if (!credentials) throw new InvalidCredentialsError();

    const passwordMatches = await bcrypt.compare(password, credentials.passwordHash);
    if (!passwordMatches) throw new InvalidCredentialsError();

    return userRepository.findById(credentials.id);
  },

  // Карточка пользователя по id: нужна перевыпуску токенов, чтобы роль и
  // существование записи проверялись по базе, а не по старым claims.
  async getById(id) {
    return userRepository.findById(id);
  },
};
