import * as z from 'zod';

// Поля заявки описываем отдельно от default: при PATCH значение по умолчанию
// затёрло бы priority. equipmentId меняется только при создании.
const requestFields = {
  equipmentId: z.uuid(),
  title: z.string().min(5).max(120),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  plannedAt: z.iso.datetime().optional(),
};

export const createRequestSchema = z.object({
  ...requestFields,
  priority: requestFields.priority.default('medium'),
});

export const updateRequestSchema = z.object(requestFields).partial().omit({ equipmentId: true });

// Схема смены статуса: через обычный PATCH статус не подменить, author необязателен.
export const statusChangeSchema = z.object({
  status: z.enum(['new', 'in_progress', 'done', 'rejected']),
  author: z.string().min(1).max(120).optional(),
});

// Схема параметра :id — чтобы мусорный идентификатор давал 422, а не 404.
export const idParamSchema = z.object({
  id: z.uuid('Некорректный формат идентификатора'),
});

// Тело назначения бригады: ровно один lead и уникальность техников проверяет сервис.
export const assignTeamSchema = z.object({
  assignees: z
    .array(
      z.object({
        technicianId: z.uuid(),
        role: z.enum(['lead', 'member']),
        hours: z.number().min(0).max(9999.99).optional(),
      }),
    )
    .min(1),
});

// Параметры маршрутов бригады: userId — идентификатор техника из справочника.
export const assigneeParamsSchema = idParamSchema.extend({
  userId: z.uuid('Некорректный формат идентификатора'),
});
