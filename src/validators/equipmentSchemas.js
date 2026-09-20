import * as z from 'zod';

// Схемы оборудования: strictObject запрещает лишние поля, поэтому «мусор» в теле
// запроса не проскочит до базы. Даты только ISO и не из будущего.
export const createEquipmentSchema = z.strictObject({
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
