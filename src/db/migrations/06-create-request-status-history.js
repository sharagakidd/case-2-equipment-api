// 06. История статусов заявки (request_status_history). Зависит от 05.
// Таблица append-only: есть только created_at, без updatedAt — записи не редактируются.
// old_status допускает NULL: первая запись появляется при создании заявки,
// когда перехода ещё не было. Смена статуса помимо этой таблицы запрещена валидацией.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('request_status_history', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    request_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'maintenance_requests', key: 'id' },
      // История удаляется вместе с заявкой.
      onDelete: 'CASCADE',
    },
    old_status: {
      type: Sequelize.ENUM('new', 'in_progress', 'done', 'rejected'),
      allowNull: true,
    },
    new_status: {
      type: Sequelize.ENUM('new', 'in_progress', 'done', 'rejected'),
      allowNull: false,
    },
    author: { type: Sequelize.STRING(120), allowNull: true },
    comment: { type: Sequelize.TEXT, allowNull: true },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  // Внешний ключ индексируем: по нему идёт выборка истории и каскадное удаление.
  await queryInterface.addIndex('request_status_history', ['request_id'], {
    name: 'request_status_history_request_id_idx',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('request_status_history');
  // dropTable не удаляет enum-типы PostgreSQL: убираем явно, иначе повторный
  // db:migrate упадёт на «type ... already exists».
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_request_status_history_old_status", "enum_request_status_history_new_status";',
  );
}
