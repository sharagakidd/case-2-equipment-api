import { BaseRepository } from './BaseRepository.js';
import { Equipment } from '../db/models/index.js';

// Сортировать разрешено только по этим полям: остальное молча игнорируем.
const SORTABLE = [
  'name',
  'type',
  'serialNumber',
  'status',
  'installedAt',
  'lat',
  'lon',
  'createdAt',
  'updatedAt',
];

function plain(instance) {
  return typeof instance.get === 'function' ? instance.get({ plain: true }) : instance;
}

// База отдаёт дробные значения строкой, поэтому координаты приводим к числам.
function toLocation(row) {
  if (row.lat === null && row.lon === null) return null;

  const lat = row.lat === null ? null : Number(row.lat);
  const lon = row.lon === null ? null : Number(row.lon);

  return { lat, lon };
}

export function toPassport(instance) {
  if (!instance) return null;

  const row = plain(instance);

  return {
    id: row.id,
    equipmentId: row.equipmentId,
    manufacturer: row.manufacturer,
    model: row.model,
    ratedPower: row.ratedPower === null ? null : Number(row.ratedPower),
    lastInspectionAt: row.lastInspectionAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Оборудование в виде для ответа API: координаты собраны в location, служебные поля скрыты.
export function toEquipment(instance) {
  if (!instance) return null;

  const row = plain(instance);
  const equipment = {
    id: row.id,
    name: row.name,
    type: row.type,
    serialNumber: row.serialNumber,
    status: row.status,
    location: toLocation(row),
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  // Паспорт подставляем только там, где его запросили вместе с оборудованием.
  if (row.passport !== undefined) equipment.passport = toPassport(row.passport);

  return equipment;
}

// Репозиторий оборудования: поиск и выборка целиком на стороне БД.
export class EquipmentRepository extends BaseRepository {
  constructor() {
    super(Equipment, {
      sortable: SORTABLE,
      // Паспорт нужен только в карточке оборудования, в списке он лишний.
      detailInclude: [{ association: 'passport' }],
    });
  }

  async findBySerialNumber(serialNumber) {
    // Без этой проверки запрос уйдёт искать пустое значение и вернёт не то, что ждут.
    if (serialNumber === undefined || serialNumber === null) return null;

    const row = await Equipment.findOne({ where: { serialNumber } });

    return row ? toEquipment(row) : null;
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
    return toEquipment(row);
  }

  referencedMessage() {
    return 'Нельзя удалить оборудование: по нему есть заявки';
  }
}
