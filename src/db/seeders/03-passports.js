// 03. Паспорта оборудования: по одной записи на каждую единицу из 02-equipment.js.
const PASSPORTS = [
  { equipment: 'SN-WT-0001', manufacturer: 'Vestas', model: 'V150-4.2', ratedPower: 4200, lastInspectionAt: '2026-03-16' },
  { equipment: 'SN-WT-0002', manufacturer: 'Vestas', model: 'V150-4.2', ratedPower: 4200, lastInspectionAt: '2026-06-02' },
  { equipment: 'SN-WT-0003', manufacturer: 'Siemens Gamesa', model: 'SG 5.0-145', ratedPower: 5000, lastInspectionAt: '2025-12-10' },
  { equipment: 'SN-INV-0001', manufacturer: 'Huawei', model: 'SUN2000-100KTL', ratedPower: 100000, lastInspectionAt: '2026-04-06' },
  { equipment: 'SN-SEN-0001', manufacturer: 'Vaisala', model: 'WXT536', ratedPower: null, lastInspectionAt: null },
  { equipment: 'SN-SUB-0001', manufacturer: 'ABB', model: 'Подстанция 110/10 кВ', ratedPower: 25000, lastInspectionAt: '2019-06-03' },
];

export async function up(queryInterface, Sequelize) {
  const equipment = await queryInterface.sequelize.query(
    'SELECT id, serial_number FROM equipment',
    { type: Sequelize.QueryTypes.SELECT },
  );
  const equipmentId = (serial) => equipment.find((unit) => unit.serial_number === serial)?.id;
  const createdAt = new Date('2026-01-16T10:00:00Z');

  await queryInterface.bulkInsert(
    'equipment_passports',
    PASSPORTS.map((passport) => ({
      equipment_id: equipmentId(passport.equipment),
      manufacturer: passport.manufacturer,
      model: passport.model,
      rated_power: passport.ratedPower,
      last_inspection_at: passport.lastInspectionAt ? new Date(passport.lastInspectionAt) : null,
      createdAt,
      updatedAt: createdAt,
    })),
    {},
  );
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(
    'DELETE FROM equipment_passports WHERE equipment_id IN (SELECT id FROM equipment WHERE serial_number IN (:serials))',
    { replacements: { serials: PASSPORTS.map((passport) => passport.equipment) } },
  );
}
