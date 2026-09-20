import * as z from 'zod';

// Схемы заявок на технику. equipmentId меняется только при создании: перенос
// заявки на другое оборудование — это уже отдельная операция, а не правка.
export const createRequestSchema = z.strictObject({
  equipmentId: z.uuid(),
  title: z.string().min(5).max(120),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  plannedAt: z.iso.datetime().optional(),
});

export const updateRequestSchema = createRequestSchema.partial().omit({ equipmentId: true });

// Отдельная схема смены статуса: только статус и ничего больше.
export const statusChangeSchema = z.strictObject({
  status: z.enum(['new', 'in_progress', 'done', 'rejected']),
});
