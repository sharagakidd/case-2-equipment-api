// 02. Оборудование (equipment). Зависит от 01-create-sites.js.
// site_id — необязательная связь: в модели данных кейса координаты являются
// свойством самого оборудования (lat/lon ниже), поэтому площадка может быть не указана.
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('equipment', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    site_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'sites', key: 'id' },
      // Площадку нельзя удалить, пока на ней числится оборудование.
      onDelete: 'RESTRICT',
    },
    name: { type: Sequelize.STRING(100), allowNull: false },
    type: {
      type: Sequelize.ENUM('turbine', 'inverter', 'sensor', 'substation'),
      allowNull: false,
    },
    serial_number: { type: Sequelize.STRING(64), allowNull: false, unique: true },
    status: {
      type: Sequelize.ENUM('operational', 'maintenance', 'fault', 'decommissioned'),
      allowNull: false,
      defaultValue: 'operational',
    },
    installed_at: { type: Sequelize.DATE, allowNull: true },
    // location { lat, lon } из модели данных кейса.
    lat: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
    lon: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
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
  await queryInterface.addIndex('equipment', ['site_id'], { name: 'equipment_site_id_idx' });
  await queryInterface.addIndex('equipment', ['status'], { name: 'equipment_status_idx' });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('equipment');
  // dropTable не удаляет enum-типы PostgreSQL: убираем явно, иначе повторный
  // db:migrate упадёт на «type ... already exists».
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_equipment_type", "enum_equipment_status";',
  );
}
