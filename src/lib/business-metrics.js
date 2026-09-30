import client from 'prom-client';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../db/index.js';
import { requestRepository } from '../repositories/index.js';
import { register } from './metrics.js';
import logger from './logger.js';

const REFRESH_INTERVAL_MS = 15000;

export const maintenanceRequests = new client.Gauge({
  name: 'maintenance_requests',
  help: 'Количество заявок по статусам и приоритетам',
  labelNames: ['status', 'priority'],
  registers: [register],
});

export const requestCloseTimeSeconds = new client.Gauge({
  name: 'maintenance_request_close_time_seconds',
  help: 'Среднее время закрытия заявки в секундах',
  registers: [register],
});

export const equipmentOpenRequests = new client.Gauge({
  name: 'equipment_open_requests',
  help: 'Открытые заявки по единицам оборудования',
  labelNames: ['equipment'],
  registers: [register],
});

export const requestsOverdue = new client.Gauge({
  name: 'maintenance_requests_overdue',
  help: 'Просроченные плановые работы: срок прошёл, заявка не закрыта',
  registers: [register],
});

const BY_STATUS_SQL = `
  SELECT status, priority, COUNT(*)::int AS count
  FROM maintenance_requests
  GROUP BY status, priority
`;

// Время закрытия берём из истории статусов: updatedAt меняется и при правке
// карточки, а запись о переходе в done остаётся одна.
const CLOSE_TIME_SQL = `
  SELECT AVG(EXTRACT(EPOCH FROM (h.created_at - r."createdAt")))::float AS avg_seconds
  FROM request_status_history h
  JOIN maintenance_requests r ON r.id = h.request_id
  WHERE h.new_status = 'done'
`;

const EQUIPMENT_LOAD_SQL = `
  SELECT e.name AS equipment, COUNT(r.id)::int AS open_requests
  FROM equipment e
  LEFT JOIN maintenance_requests r
    ON r.equipment_id = e.id AND r.status IN ('new', 'in_progress')
  WHERE e."deletedAt" IS NULL
  GROUP BY e.name
  ORDER BY open_requests DESC, e.name
`;

export async function refreshBusinessMetrics() {
  const [byStatus, closeTime, equipmentLoad, overdue] = await Promise.all([
    sequelize.query(BY_STATUS_SQL, { type: QueryTypes.SELECT }),
    sequelize.query(CLOSE_TIME_SQL, { type: QueryTypes.SELECT }),
    sequelize.query(EQUIPMENT_LOAD_SQL, { type: QueryTypes.SELECT }),
    requestRepository.countOverdue(),
  ]);

  maintenanceRequests.reset();
  for (const row of byStatus) {
    maintenanceRequests.set({ status: row.status, priority: row.priority }, row.count);
  }

  requestCloseTimeSeconds.set(closeTime[0]?.avg_seconds ?? 0);

  equipmentOpenRequests.reset();
  for (const row of equipmentLoad) {
    equipmentOpenRequests.set({ equipment: row.equipment }, row.open_requests);
  }

  requestsOverdue.set(overdue);
}

export function startBusinessMetrics() {
  const run = () =>
    refreshBusinessMetrics().catch((err) => logger.warn({ err }, 'не удалось обновить бизнес-метрики'));

  run();
  setInterval(run, REFRESH_INTERVAL_MS).unref();
}
