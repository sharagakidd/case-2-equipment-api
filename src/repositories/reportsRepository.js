import { QueryTypes } from 'sequelize';
import { sequelize } from '../db/models/index.js';

// Фильтры уходят в базу параметрами: начало периода, конец периода, минимум заявок.
const EQUIPMENT_LOAD_SQL = `
  SELECT
    e.id,
    e.name,
    e.serial_number,
    COUNT(r.id) AS total_requests,
    COUNT(r.id) FILTER (WHERE r.status = 'done') AS done_requests,
    COALESCE(SUM(ra.hours), 0) AS total_hours,
    MAX(r."updatedAt") FILTER (WHERE r.status = 'done') AS last_maintenance
  FROM equipment e
  LEFT JOIN maintenance_requests r ON r.equipment_id = e.id
    AND ($1::timestamptz IS NULL OR r."createdAt" >= $1)
    AND ($2::timestamptz IS NULL OR r."createdAt" <= $2)
  LEFT JOIN request_assignees ra ON ra.request_id = r.id
  -- Мягко удалённое оборудование отсекаем руками: paranoid фильтрует только ORM-выборки.
  WHERE e."deletedAt" IS NULL
  GROUP BY e.id
  HAVING COUNT(r.id) >= $3
  ORDER BY total_requests DESC
`;

// Драйвер отдаёт счётчики и часы строками: приводим их к числам.
function toEquipmentLoadRow(row) {
  return {
    ...row,
    total_requests: Number(row.total_requests),
    done_requests: Number(row.done_requests),
    total_hours: Number(row.total_hours),
  };
}

export class ReportsRepository {
  async getEquipmentLoad({ from = null, to = null, minRequests = 0 } = {}) {
    const rows = await sequelize.query(EQUIPMENT_LOAD_SQL, {
      bind: [from, to, minRequests],
      type: QueryTypes.SELECT,
    });

    return rows.map(toEquipmentLoadRow);
  }
}
