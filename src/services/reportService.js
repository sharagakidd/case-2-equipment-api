import { reportRepository } from '../repositories/index.js';

// Аналитика: расчёты целиком на стороне БД, сервис только передаёт фильтры.
export const reportService = {
  async getEquipmentLoad({ siteId = null } = {}) {
    return reportRepository.getEquipmentLoad({ siteId });
  },
};
