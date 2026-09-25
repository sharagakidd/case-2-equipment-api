// 05. Заявки на обслуживание: 20 записей, покрывающих все статусы и приоритеты.
// Зависит от 02-equipment.js: оборудование ищется по серийному номеру.
const DAY_MS = 24 * 60 * 60 * 1000;
// Сколько дней заявка живёт до последнего изменения: согласовано с историей в 07.
const UPDATED_AFTER_DAYS = { new: 0, in_progress: 1, done: 3, rejected: 2 };

const REQUESTS = [
  { equipment: 'SN-WT-0001', title: 'Замена масла в редукторе', priority: 'medium', status: 'done', plannedAt: '2026-05-12', createdAt: '2026-05-04', author: 'Ковалёв А.В.', description: 'Плановое обслуживание по регламенту.' },
  { equipment: 'SN-WT-0001', title: 'Трещина на лопасти №2', priority: 'critical', status: 'in_progress', plannedAt: '2026-09-26', createdAt: '2026-09-22', author: 'Диспетчерская', description: 'Найдена при обходе, турбина остановлена.' },
  { equipment: 'SN-WT-0001', title: 'Проверка датчика вибрации', priority: 'low', status: 'new', plannedAt: null, createdAt: '2026-09-24', author: 'system', description: 'Редкие выбросы в телеметрии.' },
  { equipment: 'SN-WT-0001', title: 'Плановое ТО гондолы', priority: 'high', status: 'done', plannedAt: '2026-06-18', createdAt: '2026-06-09', author: 'Ковалёв А.В.', description: 'Регламентное ТО по графику.' },
  { equipment: 'SN-WT-0001', title: 'Замена тормозных колодок', priority: 'medium', status: 'done', plannedAt: '2026-07-03', createdAt: '2026-06-27', author: 'Иванов И.И.', description: 'Износ колодок выше нормы.' },
  { equipment: 'SN-WT-0002', title: 'Утечка масла в гидравлике', priority: 'high', status: 'in_progress', plannedAt: '2026-09-25', createdAt: '2026-09-18', author: 'Диспетчерская', description: 'Подтёки на приводе поворота.' },
  { equipment: 'SN-WT-0002', title: 'Калибровка датчика угла поворота', priority: 'low', status: 'rejected', plannedAt: null, createdAt: '2026-07-21', author: 'system', description: 'Показания разошлись с расчётными.' },
  { equipment: 'SN-WT-0002', title: 'Шум в подшипнике генератора', priority: 'critical', status: 'in_progress', plannedAt: '2026-09-29', createdAt: '2026-09-23', author: 'Смирнова Е.П.', description: 'Посторонний шум на номинале.' },
  { equipment: 'SN-WT-0002', title: 'Замена щёток заземления', priority: 'medium', status: 'new', plannedAt: '2026-10-05', createdAt: '2026-09-24', author: 'Иванов И.И.', description: 'Щётки изношены, заказаны новые.' },
  { equipment: 'SN-WT-0003', title: 'Ремонт системы охлаждения', priority: 'high', status: 'in_progress', plannedAt: '2026-09-24', createdAt: '2026-09-15', author: 'Ковалёв А.В.', description: 'Перегрев при нагрузке выше 70%.' },
  { equipment: 'SN-WT-0003', title: 'Замена датчика температуры', priority: 'medium', status: 'rejected', plannedAt: null, createdAt: '2026-08-02', author: 'system', description: 'Отклонена после диагностики датчика.' },
  { equipment: 'SN-WT-0003', title: 'Трещина в корпусе ступицы', priority: 'critical', status: 'new', plannedAt: '2026-09-26', createdAt: '2026-09-25', author: 'Диспетчерская', description: 'Нужен осмотр с автовышки.' },
  { equipment: 'SN-WT-0003', title: 'Обслуживание системы смазки', priority: 'low', status: 'done', plannedAt: '2026-08-20', createdAt: '2026-08-11', author: 'Иванов И.И.', description: 'Плановая замена фильтров.' },
  { equipment: 'SN-WT-0003', title: 'Проверка молниезащиты', priority: 'high', status: 'new', plannedAt: null, createdAt: '2026-09-24', author: 'Смирнова Е.П.', description: 'Контроль заземления контура.' },
  { equipment: 'SN-INV-0001', title: 'Замена вентилятора охлаждения', priority: 'high', status: 'done', plannedAt: '2026-07-15', createdAt: '2026-07-06', author: 'Петров П.П.', description: 'Вентилятор шумит, замена по гарантии.' },
  { equipment: 'SN-INV-0001', title: 'Ошибка изоляции DC-шины', priority: 'critical', status: 'rejected', plannedAt: null, createdAt: '2026-07-28', author: 'Диспетчерская', description: 'Авария не подтвердилась после перезапуска.' },
  { equipment: 'SN-INV-0001', title: 'Обновление прошивки контроллера', priority: 'medium', status: 'new', plannedAt: '2026-09-30', createdAt: '2026-09-23', author: 'Петров П.П.', description: 'Новая версия от производителя.' },
  { equipment: 'SN-SEN-0001', title: 'Тарировка анемометра', priority: 'low', status: 'done', plannedAt: '2026-08-05', createdAt: '2026-07-30', author: 'Смирнова Е.П.', description: 'Сверка с эталонным прибором.' },
  { equipment: 'SN-SEN-0001', title: 'Обрыв кабеля датчика', priority: 'high', status: 'in_progress', plannedAt: '2026-09-25', createdAt: '2026-09-20', author: 'Петров П.П.', description: 'Нет сигнала с канала 3.' },
  { equipment: 'SN-SUB-0001', title: 'Демонтаж трансформатора Т2', priority: 'high', status: 'new', plannedAt: '2026-10-12', createdAt: '2026-09-19', author: 'Ковалёв А.В.', description: 'Вывод оборудования из эксплуатации.' },
];

export async function up(queryInterface, Sequelize) {
  const equipment = await queryInterface.sequelize.query('SELECT id, serial_number FROM equipment', {
    type: Sequelize.QueryTypes.SELECT,
  });
  const equipmentId = (serial) => equipment.find((unit) => unit.serial_number === serial)?.id;

  await queryInterface.bulkInsert(
    'maintenance_requests',
    REQUESTS.map((request) => {
      const createdAt = new Date(request.createdAt);
      const updatedAt = new Date(createdAt.getTime() + UPDATED_AFTER_DAYS[request.status] * DAY_MS);

      return {
        equipment_id: equipmentId(request.equipment),
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
        planned_at: request.plannedAt ? new Date(request.plannedAt) : null,
        author: request.author,
        createdAt,
        updatedAt,
      };
    }),
    {},
  );
}

export async function down(queryInterface) {
  // Заявки создаются только сидами; назначения и история уходят каскадом.
  await queryInterface.bulkDelete('maintenance_requests', null, {});
}
