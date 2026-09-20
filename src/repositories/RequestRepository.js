import { BaseRepository } from './BaseRepository.js';

// Незакрытые заявки: техника ещё занята или находится в ремонте.
const OPEN_STATUSES = ['new', 'in_progress'];

// Репозиторий заявок на технику: ищем заявки по оборудованию и проверяем,
// есть ли по нему незакрытые — от этого зависит, можно ли списывать технику.
export class RequestRepository extends BaseRepository {
  // Новые заявки идут первыми — так удобнее показывать историю по технике.
  findByEquipmentId(equipmentId) {
    if (equipmentId === undefined || equipmentId === null) return [];

    return this.findAll({ filters: { equipmentId }, sort: '-createdAt' }).data;
  }

  // filters игнорирует undefined, поэтому проверяем его сами: иначе вызов без
  // equipmentId посчитал бы открытые заявки по всей технике и вернул true.
  hasOpenRequests(equipmentId) {
    if (equipmentId === undefined || equipmentId === null) return false;

    const { total } = this.findAll({ filters: { equipmentId, status: OPEN_STATUSES } });

    return total > 0;
  }
}
