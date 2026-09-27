import * as z from 'zod';

// Параметры аналитики: без siteId считаем по всем площадкам, с ним — по одной.
export const equipmentLoadQuery = z.object({
  siteId: z.uuid().optional(),
});
