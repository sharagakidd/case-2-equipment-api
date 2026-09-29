import { requestService } from '../services/requestService.js';
import { sendList, sendOne } from '../utils/response.js';

export const requestController = {
  list: async (req, res) => {
    // sortBy/order не поля сущности — в filters их не отдаём.
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

  // Смену статуса выполняет вошедший пользователь: по нему сервис проверяет право
  // и записывает автора перехода в историю.
  changeStatus: async (req, res) => {
    const item = await requestService.changeStatus(req.params.id, req.valid.body.status, { user: req.user });
    sendOne(res, item);
  },

  // Состав бригады приходит в теле, правила (ровно один lead, дубли) проверяет сервис.
  // Назначения создаются заново, поэтому отвечаем 201 и адресом подресурса бригады.
  assignTeam: async (req, res) => {
    const item = await requestService.assignTeam(req.params.id, req.valid.body.assignees);
    res
      .status(201)
      .location(`/api/requests/${req.params.id}/assignees`)
      .json({ data: item });
  },

  // :userId — идентификатор техника из справочника, в сервис уходит как technicianId.
  // Удалили — отдаём 204 без тела: перечитывать заявку ради этого не нужно.
  removeAssignee: async (req, res) => {
    await requestService.removeAssignee(req.params.id, req.valid.params.userId);
    res.status(204).send();
  },

  history: async (req, res) => {
    const history = await requestService.getHistory(req.params.id);
    sendOne(res, history);
  },

  remove: async (req, res) => {
    await requestService.remove(req.params.id);
    res.status(204).send();
  },

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
