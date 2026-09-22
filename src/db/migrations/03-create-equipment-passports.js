// 03. Паспорт оборудования (equipment_passports). Зависит от 02-create-equipment.js.
// Связь 1:1 (equipment_id UNIQUE) с ON DELETE CASCADE: паспорт живёт вместе
// с оборудованием и удаляется вместе с ним.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('equipment_passports', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    equipment_id: {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'equipment', key: 'id' },
      onDelete: 'CASCADE',
    },
    manufacturer: { type: Sequelize.STRING(120), allowNull: false },
    model: { type: Sequelize.STRING(120), allowNull: false },
    rated_power: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    last_inspection_at: { type: Sequelize.DATE, allowNull: true },
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
}

export async function down(queryInterface) {
  await queryInterface.dropTable('equipment_passports');
}
