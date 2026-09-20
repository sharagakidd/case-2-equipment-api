import * as z from 'zod';

// Схемы query-параметров списков: из строки запроса всё приходит строками,
// поэтому числа приводим через coerce. Лишние параметры (utm, _t и подобные)
// здесь намеренно игнорируются, в отличие от строгих схем тела запроса.
export const equipmentListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['operational', 'maintenance', 'fault', 'decommissioned']).optional(),
  type: z.enum(['turbine', 'inverter', 'sensor', 'substation']).optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const requestListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['new', 'in_progress', 'done', 'rejected']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  equipmentId: z.uuid().optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});
