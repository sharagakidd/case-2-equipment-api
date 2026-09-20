import * as z from 'zod';

// Схемы заявок. Поля описаны отдельно от default: при обновлении значение
// по умолчанию не подставляется, иначе PATCH затирал бы priority.
// equipmentId меняется только при создании — в патче это поле игнорируется.
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

// Отдельная схема смены статуса: только статус и ничего больше.
export const statusChangeSchema = z.object({
  status: z.enum(['new', 'in_progress', 'done', 'rejected']),
});

// Схема параметра :id — чтобы мусорный идентификатор давал 422, а не 404.
export const idParamSchema = z.object({
  id: z.uuid('Некорректный формат идентификатора'),
});
