// 01. Площадки: два объекта в разных регионах — основа для отчётов по площадкам.
const SITES = [
  {
    name: 'Ветропарк Северный',
    code: 'VN-01',
    region: 'Мурманская область',
    lat: 68.958333,
    lon: 33.082778,
  },
  {
    name: 'Солнечная станция Южная',
    code: 'SU-02',
    region: 'Краснодарский край',
    lat: 45.03547,
    lon: 38.975313,
  },
];

export async function up(queryInterface) {
  const createdAt = new Date('2026-01-12T08:00:00Z');

  await queryInterface.bulkInsert(
    'sites',
    SITES.map((site) => ({ ...site, createdAt, updatedAt: createdAt })),
    {},
  );
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('DELETE FROM sites WHERE code IN (:codes)', {
    replacements: { codes: SITES.map((site) => site.code) },
  });
}
