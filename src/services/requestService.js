import { sequelize } from '../db/index.js';
import { requestRepository, equipmentRepository, technicianRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { ValidationError } from '../errors/ValidationError.js';

// Допустимые переходы статуса: done и rejected — конечные.
const ALLOWED_TRANSITIONS = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

// Некорректный состав бригады — 422 со списком проблем.
function invalidTeam(message) {
  return new ValidationError([{ field: 'assignees', message }], 'Некорректный состав бригады');
}

// Бизнес-логика заявок: создание, обновление и правила смены статуса.
export const requestService = {
  async getAll({ filters, sort, pagination }) {
    return requestRepository.findAll({ filters, sort, pagination });
  },

  async getById(id) {
    const item = await requestRepository.findById(id);
    if (!item) throw new NotFoundError('Заявка');
    return item;
  },

  async create(data) {
    if (!(await equipmentRepository.exists(data.equipmentId))) {
      throw new NotFoundError('Оборудование');
    }
    return requestRepository.create({ ...data, status: 'new' });
  },

  async update(id, data) {
    if (!(await requestRepository.exists(id))) throw new NotFoundError('Заявка');
    return requestRepository.update(id, data);
  },

  // Смена статуса и история — одной транзакцией; строку заявки блокируем от гонок.
  async changeStatus(id, newStatus, author) {
    return sequelize.transaction(async (transaction) => {
      const request = await requestRepository.findRowForUpdate(id, { transaction });
      if (!request) throw new NotFoundError('Заявка');

      const allowed = ALLOWED_TRANSITIONS[request.status] || [];
      if (!allowed.includes(newStatus)) {
        throw new ConflictError(`Недопустимый переход статуса: ${request.status} → ${newStatus}`);
      }

      if (newStatus === 'in_progress' && (await requestRepository.countAssignees(id, { transaction })) === 0) {
        throw new ConflictError('Нельзя взять заявку в работу без назначенных исполнителей');
      }

      await requestRepository.update(id, { status: newStatus }, { transaction });
      await requestRepository.addStatusHistory(
        { requestId: id, oldStatus: request.status, newStatus, author },
        { transaction },
      );

      return requestRepository.findById(id, { transaction });
    });
  },

  // Состав бригады проверяем до транзакции, замену назначений — под блокировкой заявки.
  async assignTeam(requestId, assignees) {
    if (!Array.isArray(assignees)) throw invalidTeam('Ожидается список исполнителей');

    const ids = assignees.map((assignee) => assignee.technicianId);
    const leads = assignees.filter((assignee) => assignee.role === 'lead');

    if (leads.length !== 1) throw invalidTeam('Нужен ровно один специалист с ролью lead');
    if (new Set(ids).size !== ids.length) throw invalidTeam('Один техник указан несколько раз');

    return sequelize.transaction(async (transaction) => {
      const request = await requestRepository.findRowForUpdate(requestId, { transaction });
      if (!request) throw new NotFoundError('Заявка');

      const existing = await technicianRepository.findExistingIds(ids, { transaction });
      if (existing.length !== ids.length) throw new NotFoundError('Техник');

      await requestRepository.replaceAssignees(requestId, assignees, { transaction });

      return requestRepository.findById(requestId, { transaction });
    });
  },

  // Снятие исполнителя: заявку тоже блокируем, чтобы не гонки с assignTeam.
  async removeAssignee(requestId, technicianId) {
    return sequelize.transaction(async (transaction) => {
      const request = await requestRepository.findRowForUpdate(requestId, { transaction });
      if (!request) throw new NotFoundError('Заявка');

      const removed = await requestRepository.removeAssignee(requestId, technicianId, { transaction });
      if (removed === 0) throw new NotFoundError('Исполнитель');

      return requestRepository.findById(requestId, { transaction });
    });
  },

  async remove(id) {
    if (!(await requestRepository.exists(id))) throw new NotFoundError('Заявка');
    await requestRepository.delete(id);
  },

  async getByEquipmentId(equipmentId) {
    if (!(await equipmentRepository.exists(equipmentId))) throw new NotFoundError('Оборудование');
    return requestRepository.findByEquipmentId(equipmentId);
  },

  // История статусов: отдаём только для существующей заявки, иначе легко получить пустой список.
  async getHistory(id) {
    if (!(await requestRepository.exists(id))) throw new NotFoundError('Заявка');
    return requestRepository.findHistory(id);
  },
};
