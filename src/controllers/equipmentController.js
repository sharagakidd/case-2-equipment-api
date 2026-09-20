import { equipmentService } from '../services/equipmentService.js';
import { sendList, sendOne } from '../utils/response.js';

// HTTP-слой оборудования: контроллер только раскладывает данные из req.valid
// по аргументам сервиса и формирует ответ, вся логика остаётся в сервисе.
export const equipmentController = {
  list: async (req, res) => {
    // sortBy/order не поля сущности: если оставить их в filters, репозиторий будет
    // искать записи с такими полями и список всегда окажется пустым.
    const { page, limit, sortBy, order, ...filters } = req.valid.query;
    const sort = sortBy ? (order === 'desc' ? `-${sortBy}` : sortBy) : undefined;

    const result = await equipmentService.getAll({ filters, sort, pagination: { page, limit } });
    sendList(res, result, page, limit);
  },

  getOne: async (req, res) => {
    const item = await equipmentService.getById(req.params.id);
    sendOne(res, item);
  },

  create: async (req, res) => {
    const item = await equipmentService.create(req.valid.body);
    res.status(201).location(`/api/v1/equipment/${item.id}`).json({ data: item });
  },

  update: async (req, res) => {
    const item = await equipmentService.update(req.params.id, req.valid.body);
    sendOne(res, item);
  },

  remove: async (req, res) => {
    await equipmentService.remove(req.params.id);
    res.status(204).send();
  },
};
