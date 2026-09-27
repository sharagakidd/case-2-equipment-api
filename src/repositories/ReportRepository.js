import { QueryTypes } from 'sequelize';
import { sequelize } from '../db/models/index.js';

// Аналитика по загрузке оборудования: счётчики заявок и часы исполнителей считает база.
// Подзапросы нужны, чтобы join с заявками не размножил строки и не завысил COUNT.
const EQUIPMENT_LOAD_SQL = `
  SELECT
    e.id,
    e.name,
    e.type,
    e.serial_number AS "serialNumber",
    e.status AS "equipmentStatus",
    s.id AS "siteId",
    s.name AS "siteName",
    COALESCE(r.total_requests, 0)::int AS "totalRequests",
    COALESCE(r.open_requests, 0)::int AS "openRequests",
    COALESCE(r.overdue_requests, 0)::int AS "overdueRequests",
    COALESCE(r.done_requests, 0)::int AS "doneRequests",
    COALESCE(h.planned_hours, 0)::float AS "plannedHours",
    r.last_request_at AS "lastRequestAt"
  FROM equipment AS e
  LEFT JOIN sites AS s ON s.id = e.site_id
  LEFT JOIN (
    SELECT
      equipment_id,
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE status IN ('new', 'in_progress')) AS open_requests,
      COUNT(*) FILTER (WHERE status IN ('new', 'in_progress') AND planned_at < now())
        AS overdue_requests,
      COUNT(*) FILTER (WHERE status = 'done') AS done_requests,
      MAX("createdAt") AS last_request_at
    FROM maintenance_requests
    GROUP BY equipment_id
  ) AS r ON r.equipment_id = e.id
  LEFT JOIN (
    SELECT mr.equipment_id, SUM(a.hours) AS planned_hours
    FROM request_assignees AS a
    JOIN maintenance_requests AS mr ON mr.id = a.request_id
    GROUP BY mr.equipment_id
  ) AS h ON h.equipment_id = e.id
  WHERE (CAST(:siteId AS uuid) IS NULL OR e.site_id = CAST(:siteId AS uuid))
  ORDER BY COALESCE(r.open_requests, 0) DESC, COALESCE(r.total_requests, 0) DESC, e.name ASC
`;

// Репозиторий отчётов: только чтение, модели не нужны — работаем запросами.
export class ReportRepository {
  async getEquipmentLoad({ siteId = null } = {}) {
    return sequelize.query(EQUIPMENT_LOAD_SQL, {
      replacements: { siteId },
      type: QueryTypes.SELECT,
    });
  }
}
