// 08. Мягкое удаление оборудования (paranoid). Физическое удаление заменяем простановкой
// deletedAt: строка остаётся в таблице, а из выборок её исключает сам Sequelize.
// Зависит от 02-create-equipment.js.
export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('equipment', 'deletedAt', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  // Обычный UNIQUE по serial_number навсегда блокировал бы номер мягко удалённой единицы,
  // поэтому заменяем его частичным уникальным индексом: уникальность только среди активных
  // строк, удалённая версия серийник не держит.
  await queryInterface.removeConstraint('equipment', 'equipment_serial_number_key');
  await queryInterface.addIndex('equipment', ['serial_number'], {
    name: 'equipment_serial_number_active_key',
    unique: true,
    where: { deletedAt: null },
  });
}

export async function down(queryInterface, Sequelize) {
  // Возвращаем физическое удаление: мягко удалённые строки убираем из таблицы, иначе после
  // удаления колонки они снова стали бы видимыми, а обычный UNIQUE по serial_number не
  // создался бы при дублях серийного номера.
  await queryInterface.sequelize.query('DELETE FROM equipment WHERE "deletedAt" IS NOT NULL;');

  await queryInterface.removeIndex('equipment', 'equipment_serial_number_active_key');
  await queryInterface.addConstraint('equipment', {
    type: 'unique',
    fields: ['serial_number'],
    name: 'equipment_serial_number_key',
  });
  await queryInterface.removeColumn('equipment', 'deletedAt');
}
