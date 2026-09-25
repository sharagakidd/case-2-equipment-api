// 06. Назначения техников на заявки: 15 записей, роли lead и member.
// Зависит от 04-technicians.js и 05-requests.js: связи ищутся по бизнес-ключам.
const ASSIGNMENTS = [
  { request: 'Замена масла в редукторе', technician: 'EMP-001', role: 'lead', hours: 6.5 },
  { request: 'Замена масла в редукторе', technician: 'EMP-004', role: 'member', hours: 6.5 },
  { request: 'Трещина на лопасти №2', technician: 'EMP-004', role: 'lead', hours: null },
  { request: 'Плановое ТО гондолы', technician: 'EMP-001', role: 'lead', hours: 9 },
  { request: 'Плановое ТО гондолы', technician: 'EMP-003', role: 'member', hours: 9 },
  { request: 'Замена тормозных колодок', technician: 'EMP-001', role: 'lead', hours: 5.5 },
  { request: 'Утечка масла в гидравлике', technician: 'EMP-001', role: 'lead', hours: null },
  { request: 'Утечка масла в гидравлике', technician: 'EMP-005', role: 'member', hours: null },
  { request: 'Шум в подшипнике генератора', technician: 'EMP-004', role: 'lead', hours: null },
  { request: 'Ремонт системы охлаждения', technician: 'EMP-002', role: 'lead', hours: null },
  { request: 'Обслуживание системы смазки', technician: 'EMP-004', role: 'lead', hours: 4 },
  { request: 'Замена вентилятора охлаждения', technician: 'EMP-002', role: 'lead', hours: 7.5 },
  { request: 'Замена вентилятора охлаждения', technician: 'EMP-003', role: 'member', hours: 7.5 },
  { request: 'Тарировка анемометра', technician: 'EMP-003', role: 'lead', hours: 3 },
  { request: 'Обрыв кабеля датчика', technician: 'EMP-002', role: 'lead', hours: null },
];

export async function up(queryInterface, Sequelize) {
  const requests = await queryInterface.sequelize.query('SELECT id, title FROM maintenance_requests', {
    type: Sequelize.QueryTypes.SELECT,
  });
  const technicians = await queryInterface.sequelize.query(
    'SELECT id, employee_number FROM technicians',
    { type: Sequelize.QueryTypes.SELECT },
  );
  const requestId = (title) => requests.find((item) => item.title === title)?.id;
  const technicianId = (number) => technicians.find((item) => item.employee_number === number)?.id;

  await queryInterface.bulkInsert(
    'request_assignees',
    ASSIGNMENTS.map((assignment) => ({
      request_id: requestId(assignment.request),
      technician_id: technicianId(assignment.technician),
      role: assignment.role,
      hours: assignment.hours,
    })),
    {},
  );
}

export async function down(queryInterface) {
  // Назначения создаются только сидами.
  await queryInterface.bulkDelete('request_assignees', null, {});
}
