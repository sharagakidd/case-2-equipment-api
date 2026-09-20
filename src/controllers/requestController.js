import { requestService } from '../services/requestService.js';
import { sendList, sendOne } from '../utils/response.js';

// HTTP-слой заявок. Список заявок по технике отдаём через getAll с фильтром,
// а getByEquipmentId вызываем как проверку существования техники (404).
export const requestController = {
  list: async (req, res) => {
    // sortBy/order не поля сущности: в filters они попасть не должны, иначе
    // выборка окажется пустой, а сортировка не применится.
    const { page, limit, sortBy, order, ...filters } = req.valid.query;
    const sort = sortBy ? (order === 'desc' ? `-${sortBy}` : sortBy) : undefined;

    const result = await requestService.getAll({ filters, sort, pagination: { page, limit } });
    sendList(res, result, page, limit);
  },

  getOne: async (req, res) => {
    const item = await requestService.getById(req.params.id);
    sendOne(res, item);
  },

  create: async (req, res) => {
    const item = await requestService.create(req.valid.body);
    res.status(201).location(`/api/requests/${item.id}`).json({ data: item });
  },

  update: async (req, res) => {
    const item = await requestService.update(req.params.id, req.valid.body);
    sendOne(res, item);
  },

  changeStatus: async (req, res) => {
    const item = await requestService.changeStatus(req.params.id, req.valid.body.status);
    sendOne(res, item);
  },

  remove: async (req, res) => {
    await requestService.remove(req.params.id);
    res.status(204).send();
  },

  // Вложенный маршрут GET /equipment/:id/requests.
  getByEquipment: async (req, res) => {
    const { page = 1, limit = 20, status, priority, sortBy, order } = req.valid?.query ?? {};

    await requestService.getByEquipmentId(req.params.id); // 404, если техники нет

    const sort = sortBy ? (order === 'desc' ? `-${sortBy}` : sortBy) : undefined;
    const result = await requestService.getAll({
      filters: { equipmentId: req.params.id, status, priority },
      sort,
      pagination: { page, limit },
    });

    sendList(res, result, page, limit);
  },
};
