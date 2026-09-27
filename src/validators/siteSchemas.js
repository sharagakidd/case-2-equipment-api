import * as z from 'zod';

// Схема параметра :id площадки — мусорный идентификатор даёт 422, а не 404.
export const idParamSchema = z.object({
  id: z.uuid('Некорректный формат идентификатора'),
});
