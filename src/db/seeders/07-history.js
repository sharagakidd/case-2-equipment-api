// 07. История статусов: цепочка переходов для каждой заявки из 05-requests.js.
const DAY_MS = 24 * 60 * 60 * 1000;
// [старый статус, новый статус, комментарий, через сколько дней после создания]
const CHAINS = {
  new: [[null, 'new', 'Заявка зарегистрирована', 0]],
  in_progress: [
    [null, 'new', 'Заявка зарегистрирована', 0],
    ['new', 'in_progress', 'Работы начаты, заявка в работе', 1],
  ],
  done: [
    [null, 'new', 'Заявка зарегистрирована', 0],
    ['new', 'in_progress', 'Работы начаты, заявка в работе', 1],
    ['in_progress', 'done', 'Работы завершены, оборудование в работе', 3],
  ],
  rejected: [
    [null, 'new', 'Заявка зарегистрирована', 0],
    ['new', 'rejected', 'Отклонена: неисправность не подтверждена', 2],
  ],
};

export async function up(queryInterface, Sequelize) {
  const requests = await queryInterface.sequelize.query(
    'SELECT id, status, author, "createdAt" FROM maintenance_requests',
    { type: Sequelize.QueryTypes.SELECT },
  );

  const rows = requests.flatMap((request) =>
    CHAINS[request.status].map(([oldStatus, newStatus, comment, days]) => ({
      request_id: request.id,
      old_status: oldStatus,
      new_status: newStatus,
      author: request.author,
      comment,
      created_at: new Date(new Date(request.createdAt).getTime() + days * DAY_MS),
    })),
  );

  await queryInterface.bulkInsert('request_status_history', rows, {});
}

export async function down(queryInterface) {
  // История создаётся только сидами.
  await queryInterface.bulkDelete('request_status_history', null, {});
}
