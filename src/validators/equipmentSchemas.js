import * as z from 'zod';

// Схемы оборудования. z.object отбрасывает неизвестные поля тела (так требует ТЗ),
// поэтому «мусор» до хранилища не доходит, но и ошибки на лишний ключ нет.
// Даты только ISO и не из будущего.
export const createEquipmentSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.enum(['turbine', 'inverter', 'sensor', 'substation']),
  serialNumber: z.string().min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  status: z.enum(['operational', 'maintenance', 'fault', 'decommissioned']).default('operational'),
  installedAt: z.iso
    .datetime()
    .refine((d) => new Date(d) <= new Date(), 'Дата не может быть в будущем'),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();
