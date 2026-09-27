import { reportService } from '../services/reportService.js';
import { sendOne } from '../utils/response.js';

// HTTP-слой отчётов: готовые агрегаты без постраничности — это аналитика, а не список.
export const reportController = {
  equipmentLoad: async (req, res) => {
    const rows = await reportService.getEquipmentLoad(req.valid.query);
    sendOne(res, rows);
  },
};
