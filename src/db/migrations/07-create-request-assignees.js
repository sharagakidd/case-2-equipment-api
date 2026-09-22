// 07. Исполнители заявки (request_assignees). Зависит от 04 и 05.
// Связь many-to-many между заявками и техниками: роль в заявке и потраченные часы.
// Пара (request_id, technician_id) уникальна — один техник в заявке указывается один раз.
// Временных меток у таблицы нет: по ТЗ это чистая связка.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('request_assignees', {
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
      // Назначения удаляются вместе с заявкой.
      onDelete: 'CASCADE',
    },
    technician_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'technicians', key: 'id' },
      // Техника нельзя удалить, пока он назначен в заявки.
      onDelete: 'RESTRICT',
    },
    role: {
      type: Sequelize.ENUM('lead', 'member'),
      allowNull: false,
    },
    hours: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
  });

  // Уникальность пары «заявка + техник».
  await queryInterface.addConstraint('request_assignees', {
    fields: ['request_id', 'technician_id'],
    type: 'unique',
    name: 'request_assignees_request_id_technician_id_key',
  });
  // Обратный поиск: в каких заявках участвует техник.
  await queryInterface.addIndex('request_assignees', ['technician_id'], {
    name: 'request_assignees_technician_id_idx',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('request_assignees');
  // dropTable не удаляет enum-типы PostgreSQL: убираем явно, иначе повторный
  // db:migrate упадёт на «type ... already exists».
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_request_assignees_role";');
}
