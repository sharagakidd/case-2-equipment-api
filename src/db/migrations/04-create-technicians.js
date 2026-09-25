// 04. Техники (technicians) — справочник исполнителей заявок.
// Независимая таблица: на неё ссылается 07-create-request-assignees.js.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('technicians', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    full_name: { type: Sequelize.STRING(150), allowNull: false },
    specialization: { type: Sequelize.STRING(120), allowNull: false },
    employee_number: { type: Sequelize.STRING(32), allowNull: false, unique: true },
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
  await queryInterface.dropTable('technicians');
}
