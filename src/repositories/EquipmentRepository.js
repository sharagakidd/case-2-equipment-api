import { BaseRepository } from './BaseRepository.js';

// Репозиторий оборудования: поверх общего CRUD нужен поиск по серийному номеру —
// по нему проверяем уникальность при создании и находим технику в запросах.
export class EquipmentRepository extends BaseRepository {
  findBySerialNumber(serialNumber) {
    // Без этой проверки filters пропустит undefined и вернёт первую запись
    // вместо «ничего не найдено».
    if (serialNumber === undefined || serialNumber === null) return null;

    const { data } = this.findAll({ filters: { serialNumber } });

    return data[0] ?? null;
  }
}
