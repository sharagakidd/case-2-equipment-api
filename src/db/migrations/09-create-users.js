// 09. Пользователи API (users): аутентификация и ролевая модель.
// Независимая таблица, внешних ключей нет.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('users', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    email: { type: Sequelize.STRING(255), allowNull: false },
    // Хранится только хеш пароля: открытый пароль в базу не попадает.
    password_hash: { type: Sequelize.STRING(255), allowNull: false },
    role: {
      type: Sequelize.ENUM('viewer', 'technician', 'admin'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  // Почта уникальна отдельным индексом: вход по email не должен находить двух
  // пользователей, а поиск по email идёт по индексу.
  await queryInterface.addIndex('users', ['email'], {
    name: 'users_email_unique_idx',
    unique: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('users');
  // dropTable не удаляет enum-типы PostgreSQL: убираем явно, иначе повторный
  // db:migrate упадёт на «type ... already exists».
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
}
