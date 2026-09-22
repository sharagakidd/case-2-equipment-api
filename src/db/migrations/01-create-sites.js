// 01. Площадки (sites) — справочник мест размещения оборудования.
// Миграции написаны в ESM (именованные экспорты): проект объявлен как
// "type": "module", поэтому CJS-заготовку из sequelize-cli Node не загружает
// («module is not defined in ES module scope»).
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('sites', {
    // UUID генерирует сама БД: gen_random_uuid() встроена в PostgreSQL 13+.
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    name: { type: Sequelize.STRING(120), allowNull: false },
    code: { type: Sequelize.STRING(32), allowNull: false, unique: true },
    region: { type: Sequelize.STRING(120), allowNull: false },
    lat: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
    lon: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
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
  await queryInterface.dropTable('sites');
}
