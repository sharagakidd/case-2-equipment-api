import { requestRepository, equipmentRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';

// Правила переходов статуса заявки: какие переходы допустимы. Закрытые статусы
// (done, rejected) — конечные, выйти из них уже нельзя.
const ALLOWED_TRANSITIONS = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

// Бизнес-логика заявок: проверка существования техники при создании и правила
// смены статуса. Новую заявку всегда создаём в статусе new, что бы ни прислали.
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

  async changeStatus(id, newStatus) {
    const request = await requestRepository.findById(id);
    if (!request) throw new NotFoundError('Заявка');

    const allowed = ALLOWED_TRANSITIONS[request.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(`Недопустимый переход статуса: ${request.status} → ${newStatus}`);
    }

    return requestRepository.update(id, { status: newStatus });
  },

  async remove(id) {
    if (!(await requestRepository.exists(id))) throw new NotFoundError('Заявка');
    await requestRepository.delete(id);
  },

  async getByEquipmentId(equipmentId) {
    if (!(await equipmentRepository.exists(equipmentId))) throw new NotFoundError('Оборудование');
    return requestRepository.findByEquipmentId(equipmentId);
  },
};
