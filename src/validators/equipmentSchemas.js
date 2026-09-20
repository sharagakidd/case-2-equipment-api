import * as z from 'zod';

// Схемы оборудования. z.object отбрасывает неизвестные поля тела (так требует ТЗ).
// Поля описаны отдельно от default: значение по умолчанию нужно только при создании,
// иначе PATCH с одним полем затирал бы status.
const equipmentFields = {
  name: z.string().min(3).max(100),
  type: z.enum(['turbine', 'inverter', 'sensor', 'substation']),
  serialNumber: z.string().min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  status: z.enum(['operational', 'maintenance', 'fault', 'decommissioned']),
  installedAt: z.iso
    .datetime()
    .refine((d) => new Date(d) <= new Date(), 'Дата не может быть в будущем'),
};

export const createEquipmentSchema = z.object({
  ...equipmentFields,
  status: equipmentFields.status.default('operational'),
});

export const updateEquipmentSchema = z.object(equipmentFields).partial();

// Схема параметра :id — чтобы мусорный идентификатор давал 422, а не 404.
export const idParamSchema = z.object({
  id: z.uuid('Некорректный формат идентификатора'),
});
