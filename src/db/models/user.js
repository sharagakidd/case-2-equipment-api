import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Роли API: viewer — только чтение, technician — работа с заявками, admin — управление
// пользователями и справочниками. Список нужен валидаторам, поэтому экспортируем его.
export const USER_ROLES = ['viewer', 'technician', 'admin'];

// Пользователь API (users), миграция 09. Атрибуты camelCase, колонки БД заданы через field.
export class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // Уникальность держит индекс users_email_unique_idx (миграция 09);
      // к нижнему регистру почту приводит слой сервиса при создании и поиске.
    },
    // Хеш пароля наружу не отдаём: поле отбрасывает маппер на слое репозитория.
    passwordHash: { type: DataTypes.STRING(255), field: 'password_hash', allowNull: false },
    // Связь со справочником техников: по ней проверяем, что специалист меняет
    // статус только своих заявок (миграция 10).
    technicianId: {
      type: DataTypes.UUID,
      field: 'technician_id',
      allowNull: true,
      references: { model: 'technicians', key: 'id' },
      onDelete: 'SET NULL',
    },
    role: {
      type: DataTypes.ENUM(...USER_ROLES),
      allowNull: false,
      defaultValue: 'viewer',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
  },
);
