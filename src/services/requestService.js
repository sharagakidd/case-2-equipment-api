import { requestRepository, equipmentRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';

// Машина состояний заявки: какие переходы допустимы. Закрытые статусы (done,
// rejected) — терминальные, из них выйти уже нельзя.
const ALLOWED_TRANSITIONS = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

// Бизнес-логика заявок: проверка существования техники при создании и правила
// смены статуса. Новую заявку всегда создаём в статусе new, что бы ни прислали.
export const requestService = {
  getAll({ filters, sort, pagination }) {
    return requestRepository.findAll({ filters, sort, pagination });
  },

  getById(id) {
    const item = requestRepository.findById(id);
    if (!item) throw new NotFoundError('Заявка');
    return item;
  },

  create(data) {
    if (!equipmentRepository.exists(data.equipmentId)) {
      throw new NotFoundError('Оборудование');
    }
    return requestRepository.create({ ...data, status: 'new' });
  },

  update(id, data) {
    if (!requestRepository.exists(id)) throw new NotFoundError('Заявка');
    return requestRepository.update(id, data);
  },

  changeStatus(id, newStatus) {
    const request = requestRepository.findById(id);
    if (!request) throw new NotFoundError('Заявка');

    const allowed = ALLOWED_TRANSITIONS[request.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(`Недопустимый переход статуса: ${request.status} → ${newStatus}`);
    }

    return requestRepository.update(id, { status: newStatus });
  },

  remove(id) {
    if (!requestRepository.exists(id)) throw new NotFoundError('Заявка');
    requestRepository.delete(id);
  },

  getByEquipmentId(equipmentId) {
    if (!equipmentRepository.exists(equipmentId)) throw new NotFoundError('Оборудование');
    return requestRepository.findByEquipmentId(equipmentId);
  },
};
