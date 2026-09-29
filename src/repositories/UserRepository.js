import { BaseRepository } from './BaseRepository.js';
import { User } from '../db/models/index.js';

// Публичное представление пользователя: хеш пароля наружу не уходит.
export function toUser(instance) {
  if (!instance) return null;

  const row = typeof instance.get === 'function' ? instance.get({ plain: true }) : instance;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Учётные данные для входа: хеш нужен только authService и в ответы не попадает.
function toCredentials(row) {
  const plain = row.get({ plain: true });

  return { id: plain.id, email: plain.email, role: plain.role, passwordHash: plain.passwordHash };
}

// Репозиторий пользователей. toDomain переопределён, поэтому все выборки
// возвращают безопасный вид: пароль не может «просочиться» через findByPk/findAll.
export class UserRepository extends BaseRepository {
  constructor() {
    super(User, { sortable: ['email', 'role', 'createdAt', 'updatedAt'] });
  }

  // С хешем: отдельный метод с говорящим именем, чтобы случайно не отдать его в ответ.
  async findCredentialsByEmail(email) {
    if (!email) return null;

    const row = await User.findOne({ where: { email } });

    return row ? toCredentials(row) : null;
  }

  async existsByEmail(email) {
    if (!email) return false;

    return (await User.count({ where: { email } })) > 0;
  }

  toDomain(row) {
    return toUser(row);
  }
}
