// 05. Заявки на обслуживание (maintenance_requests). Зависит от 02-create-equipment.js.
// ON DELETE RESTRICT: оборудование с заявками удалить нельзя — сначала заявки,
// иначе потеряется история работ.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('maintenance_requests', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    equipment_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'equipment', key: 'id' },
      onDelete: 'RESTRICT',
    },
    title: { type: Sequelize.STRING(120), allowNull: false },
    description: { type: Sequelize.TEXT, allowNull: true },
    priority: {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: Sequelize.ENUM('new', 'in_progress', 'done', 'rejected'),
      allowNull: false,
      defaultValue: 'new',
    },
    planned_at: { type: Sequelize.DATE, allowNull: true },
    author: { type: Sequelize.STRING(120), allowNull: true },
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

  // Внешние ключи PostgreSQL не индексирует автоматически, status — частый фильтр в API.
  await queryInterface.addIndex('maintenance_requests', ['equipment_id'], {
    name: 'maintenance_requests_equipment_id_idx',
  });
  await queryInterface.addIndex('maintenance_requests', ['status'], {
    name: 'maintenance_requests_status_idx',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('maintenance_requests');
  // dropTable не удаляет enum-типы PostgreSQL: убираем явно, иначе повторный
  // db:migrate упадёт на «type ... already exists».
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_maintenance_requests_priority", "enum_maintenance_requests_status";',
  );
}
