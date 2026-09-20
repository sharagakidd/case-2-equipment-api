import { equipmentRepository, requestRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';

// Бизнес-логика оборудования: проверки уникальности и ссылочной целостности
// живут здесь, репозитории остаются «тупыми» хранилищами.
export const equipmentService = {
  getAll({ filters, sort, pagination }) {
    return equipmentRepository.findAll({ filters, sort, pagination });
  },

  getById(id) {
    const item = equipmentRepository.findById(id);
    if (!item) throw new NotFoundError('Оборудование');
    return item;
  },

  create(data) {
    const existing = equipmentRepository.findBySerialNumber(data.serialNumber);
    if (existing) throw new ConflictError('Оборудование с таким серийным номером уже существует');
    return equipmentRepository.create(data);
  },

  update(id, data) {
    if (!equipmentRepository.exists(id)) throw new NotFoundError('Оборудование');
    return equipmentRepository.update(id, data);
  },

  remove(id) {
    if (!equipmentRepository.exists(id)) throw new NotFoundError('Оборудование');
    if (requestRepository.hasOpenRequests(id)) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками');
    }
    equipmentRepository.delete(id);
  },
};
