import { Op, col, fn } from 'sequelize';
import { BaseRepository } from './BaseRepository.js';
import { Equipment, MaintenanceRequest, RequestAssignee, Site } from '../db/models/index.js';

const SORTABLE = ['name', 'code', 'region', 'createdAt', 'updatedAt'];

// Площадка в виде для ответа API: координаты собраны в location, как у оборудования.
function toSite(instance) {
  if (!instance) return null;

  const row = instance.get({ plain: true });
  const location =
    row.lat === null && row.lon === null ? null : { lat: Number(row.lat), lon: Number(row.lon) };

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    region: row.region,
    location,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GROUP BY отдаёт строки вида { status, total } — приводим их к карте статусов.
function toCounts(rows) {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

// Репозиторий площадок: справочник пока не выведен в API, нужны базовые операции.
export class SiteRepository extends BaseRepository {
  constructor() {
    super(Site, { sortable: SORTABLE });
  }

  async findByCode(code) {
    if (code === undefined || code === null) return null;

    const row = await Site.findOne({ where: { code } });

    return row ? toSite(row) : null;
  }

  // Сводка площадки: считаем в базе, наружу отдаём готовые карты «статус → количество».
  async countEquipmentByStatus(siteId) {
    const rows = await Equipment.findAll({
      where: { siteId },
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    });

    return toCounts(rows);
  }

  async findEquipmentIds(siteId) {
    const rows = await Equipment.findAll({ where: { siteId }, attributes: ['id'], raw: true });

    return rows.map((row) => row.id);
  }

  // Заявки площадки отбираем по её оборудованию: join здесь лишний.
  async countRequestsByStatus(equipmentIds) {
    if (equipmentIds.length === 0) return {};

    const rows = await MaintenanceRequest.findAll({
      where: { equipmentId: { [Op.in]: equipmentIds } },
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    });

    return toCounts(rows);
  }

  async sumPlannedHours(equipmentIds) {
    if (equipmentIds.length === 0) return 0;

    const requests = await MaintenanceRequest.findAll({
      where: { equipmentId: { [Op.in]: equipmentIds } },
      attributes: ['id'],
      raw: true,
    });
    if (requests.length === 0) return 0;

    const hours = await RequestAssignee.sum('hours', {
      where: { requestId: { [Op.in]: requests.map((row) => row.id) } },
    });

    return hours === null ? 0 : Number(hours);
  }

  // location из тела запроса раскладываем в колонки lat/lon.
  toColumns(data) {
    const { location, ...rest } = data;
    const columns = super.toColumns(rest);

    if (location) {
      columns.lat = location.lat;
      columns.lon = location.lon;
    }

    return columns;
  }

  toDomain(row) {
    return toSite(row);
  }

  referencedMessage() {
    return 'Нельзя удалить площадку: на ней ещё есть оборудование';
  }
}
