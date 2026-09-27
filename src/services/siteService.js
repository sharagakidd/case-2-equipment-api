import { siteRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';

// В сводке показываем все статусы, включая нулевые: клиенту не нужно достраивать их самому.
const EQUIPMENT_STATUSES = ['operational', 'maintenance', 'fault', 'decommissioned'];
const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'rejected'];
const OPEN_REQUEST_STATUSES = ['new', 'in_progress'];

function byStatus(statuses, counts) {
  return Object.fromEntries(statuses.map((status) => [status, counts[status] ?? 0]));
}

function total(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

// Бизнес-логика площадок: пока доступна только сводка по объекту.
export const siteService = {
  async getSummary(id) {
    const site = await siteRepository.findById(id);
    if (!site) throw new NotFoundError('Площадка');

    const equipmentIds = await siteRepository.findEquipmentIds(id);
    const [equipmentCounts, requestCounts, plannedHours] = await Promise.all([
      siteRepository.countEquipmentByStatus(id),
      siteRepository.countRequestsByStatus(equipmentIds),
      siteRepository.sumPlannedHours(equipmentIds),
    ]);

    const equipment = byStatus(EQUIPMENT_STATUSES, equipmentCounts);
    const requests = byStatus(REQUEST_STATUSES, requestCounts);

    return {
      site,
      equipment: { total: total(equipment), byStatus: equipment },
      requests: {
        total: total(requests),
        open: OPEN_REQUEST_STATUSES.reduce((sum, status) => sum + requests[status], 0),
        byStatus: requests,
      },
      assignees: { plannedHours },
    };
  },
};
