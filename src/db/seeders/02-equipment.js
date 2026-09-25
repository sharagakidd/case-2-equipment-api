// 02. Оборудование: 6 единиц на двух площадках — все типы и статусы справочника.
// Зависит от 01-sites.js: площадка ищется по коду.
const EQUIPMENT = [
  { site: 'VN-01', name: 'Ветротурбина №1', type: 'turbine', serialNumber: 'SN-WT-0001', status: 'operational', installedAt: '2021-05-12', lat: 68.958333, lon: 33.082778 },
  { site: 'VN-01', name: 'Ветротурбина №2', type: 'turbine', serialNumber: 'SN-WT-0002', status: 'maintenance', installedAt: '2021-05-12', lat: 68.960111, lon: 33.079444 },
  { site: 'VN-01', name: 'Ветротурбина №3', type: 'turbine', serialNumber: 'SN-WT-0003', status: 'fault', installedAt: '2022-03-01', lat: 68.956777, lon: 33.086111 },
  { site: 'SU-02', name: 'Сетевой инвертор №1', type: 'inverter', serialNumber: 'SN-INV-0001', status: 'operational', installedAt: '2022-08-20', lat: 45.03547, lon: 38.975313 },
  { site: 'SU-02', name: 'Метеостанция', type: 'sensor', serialNumber: 'SN-SEN-0001', status: 'operational', installedAt: '2023-01-15', lat: 45.0361, lon: 38.976 },
  { site: 'SU-02', name: 'Подстанция 110/10 кВ', type: 'substation', serialNumber: 'SN-SUB-0001', status: 'decommissioned', installedAt: '2018-11-30', lat: 45.0349, lon: 38.9748 },
];

export async function up(queryInterface, Sequelize) {
  const sites = await queryInterface.sequelize.query('SELECT id, code FROM sites', {
    type: Sequelize.QueryTypes.SELECT,
  });
  const siteId = (code) => sites.find((site) => site.code === code)?.id;
  const createdAt = new Date('2026-01-15T09:00:00Z');

  await queryInterface.bulkInsert(
    'equipment',
    EQUIPMENT.map((unit) => ({
      site_id: siteId(unit.site),
      name: unit.name,
      type: unit.type,
      serial_number: unit.serialNumber,
      status: unit.status,
      installed_at: new Date(unit.installedAt),
      lat: unit.lat,
      lon: unit.lon,
      createdAt,
      updatedAt: createdAt,
    })),
    {},
  );
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('DELETE FROM equipment WHERE serial_number IN (:serials)', {
    replacements: { serials: EQUIPMENT.map((unit) => unit.serialNumber) },
  });
}
