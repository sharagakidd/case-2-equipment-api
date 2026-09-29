import { Op } from 'sequelize';
import { BaseRepository } from './BaseRepository.js';
import { MaintenanceRequest, RequestAssignee, RequestStatusHistory } from '../db/models/index.js';
import { toEquipment } from './EquipmentRepository.js';

// Незакрытые заявки: оборудование занято или находится в ремонте.
const OPEN_STATUSES = ['new', 'in_progress'];
const SORTABLE = ['title', 'priority', 'status', 'plannedAt', 'author', 'createdAt', 'updatedAt'];

const LIST_INCLUDE = [{ association: 'equipment' }, { association: 'assignees' }];
const DETAIL_INCLUDE = [...LIST_INCLUDE, { association: 'history' }];

// Связанные записи приходят и моделями, и обычными объектами — нужен общий разбор.
function plain(instance) {
  return typeof instance.get === 'function' ? instance.get({ plain: true }) : instance;
}

// Роль и часы техника лежат в связующей таблице request_assignees.
function toAssignee(instance) {
  const row = plain(instance);
  const link = row.RequestAssignee ?? {};

  return {
    id: row.id,
    fullName: row.fullName,
    specialization: row.specialization,
    employeeNumber: row.employeeNumber,
    role: link.role ?? null,
    hours: link.hours === undefined || link.hours === null ? null : Number(link.hours),
  };
}

function toHistoryEntry(instance) {
  const row = plain(instance);

  return {
    id: row.id,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    author: row.author,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

// Заявка в виде для ответа API. Вложенные данные появляются только по запросу.
export function toRequest(instance) {
  if (!instance) return null;

  const row = instance.get({ plain: true });
  const request = {
    id: row.id,
    equipmentId: row.equipmentId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    plannedAt: row.plannedAt,
    author: row.author,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (row.equipment !== undefined) request.equipment = toEquipment(row.equipment);
  if (row.assignees !== undefined) request.assignees = row.assignees.map(toAssignee);
  if (row.history !== undefined) request.history = row.history.map(toHistoryEntry);

  return request;
}

export class RequestRepository extends BaseRepository {
  constructor() {
    super(MaintenanceRequest, {
      sortable: SORTABLE,
      listInclude: LIST_INCLUDE,
      detailInclude: DETAIL_INCLUDE,
    });
  }

  async findByEquipmentId(equipmentId) {
    if (equipmentId === undefined || equipmentId === null) return [];

    // Новые заявки первыми — так удобнее показывать историю по оборудованию.
    const { data } = await this.findAll({ filters: { equipmentId }, sort: '-createdAt' });

    return data;
  }

  // История статусов отдельным запросом: карточку заявки для этого тянуть не нужно.
  async findHistory(requestId) {
    if (requestId === undefined || requestId === null) return [];

    const rows = await RequestStatusHistory.findAll({
      where: { requestId },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return rows.map(toHistoryEntry);
  }

  async countAssignees(requestId, { transaction } = {}) {
    return RequestAssignee.count({ where: { requestId }, transaction });
  }

  // Назначен ли конкретный техник на заявку — проверка права на смену статуса.
  async isAssignee(requestId, technicianId, { transaction } = {}) {
    if (!requestId || !technicianId) return false;

    const total = await RequestAssignee.count({ where: { requestId, technicianId }, transaction });

    return total > 0;
  }

  async addStatusHistory({ requestId, oldStatus, newStatus, author, comment }, { transaction } = {}) {
    const row = await RequestStatusHistory.create(
      { requestId, oldStatus, newStatus, author, comment },
      { transaction },
    );

    return toHistoryEntry(row);
  }

  // Замена бригады одной транзакцией: иначе при ошибке заявка осталась бы без исполнителей.
  async replaceAssignees(requestId, assignees, { transaction } = {}) {
    await RequestAssignee.destroy({ where: { requestId }, transaction });

    const rows = await RequestAssignee.bulkCreate(
      assignees.map(({ technicianId, role, hours }) => ({
        requestId,
        technicianId,
        role,
        hours: hours ?? null,
      })),
      { transaction },
    );

    return rows.map((row) => row.get({ plain: true }));
  }

  async removeAssignee(requestId, technicianId, { transaction } = {}) {
    if (technicianId === undefined || technicianId === null) return 0;

    return RequestAssignee.destroy({ where: { requestId, technicianId }, transaction });
  }

  // Наличие незакрытых заявок — это факт, тянуть сами строки не нужно.
  async hasOpenRequests(equipmentId) {
    if (equipmentId === undefined || equipmentId === null) return false;

    const total = await this.model.count({
      where: { equipmentId, status: { [Op.in]: OPEN_STATUSES } },
    });

    return total > 0;
  }

  toDomain(row) {
    return toRequest(row);
  }

  referencedMessage() {
    return 'Нельзя удалить заявку: на неё ссылаются назначения или история';
  }
}
