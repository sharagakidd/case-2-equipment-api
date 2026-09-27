import { siteService } from '../services/siteService.js';
import { sendOne } from '../utils/response.js';

// HTTP-слой площадок: пока только сводка, сам справочник в API не выведен.
export const siteController = {
  summary: async (req, res) => {
    const summary = await siteService.getSummary(req.params.id);
    sendOne(res, summary);
  },
};
