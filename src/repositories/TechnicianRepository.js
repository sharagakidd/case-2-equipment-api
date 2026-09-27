import { Op } from 'sequelize';
import { BaseRepository } from './BaseRepository.js';
import { Technician } from '../db/models/index.js';

const SORTABLE = ['fullName', 'specialization', 'employeeNumber', 'createdAt', 'updatedAt'];

// Техник для ответа API: только поля справочника.
function toTechnician(instance) {
  if (!instance) return null;

  const row = instance.get({ plain: true });

  return {
    id: row.id,
    fullName: row.fullName,
    specialization: row.specialization,
    employeeNumber: row.employeeNumber,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Техники: проверка существования исполнителей заявки.
export class TechnicianRepository extends BaseRepository {
  constructor() {
    super(Technician, { sortable: SORTABLE });
  }

  // Отдаём только найденные id: что делать с остальными, решает сервис.
  async findExistingIds(ids, { transaction } = {}) {
    if (!ids || ids.length === 0) return [];

    const rows = await Technician.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id'],
      raw: true,
      transaction,
    });

    return rows.map((row) => row.id);
  }

  toDomain(row) {
    return toTechnician(row);
  }
}
