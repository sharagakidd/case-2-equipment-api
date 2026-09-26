import { Op } from 'sequelize';
import { BaseRepository } from './BaseRepository.js';
import { MaintenanceRequest } from '../db/models/index.js';
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

// Репозиторий заявок: заявки по оборудованию и проверка незакрытых — запросами в БД.
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
