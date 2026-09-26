import { BaseRepository } from './BaseRepository.js';
import { Site } from '../db/models/index.js';

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
