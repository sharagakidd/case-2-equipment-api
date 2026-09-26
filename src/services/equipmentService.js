import { equipmentRepository, requestRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { weatherService } from './weatherService.js';
import { config } from '../config/index.js';

// Бизнес-логика оборудования: проверки уникальности и ссылочной целостности живут
// здесь — репозитории только читают и пишут данные.
export const equipmentService = {
  async getAll({ filters, sort, pagination }) {
    return equipmentRepository.findAll({ filters, sort, pagination });
  },

  // Карточка отдаётся вместе с паспортом (если строки паспорта нет — ключ null):
  // в списке паспорт лишний, а в карточке он нужен.
  async getById(id) {
    const item = await equipmentRepository.findById(id);
    if (!item) throw new NotFoundError('Оборудование');
    return item;
  },

  async create(data) {
    const existing = await equipmentRepository.findBySerialNumber(data.serialNumber);
    if (existing) throw new ConflictError('Оборудование с таким серийным номером уже существует');
    return equipmentRepository.create(data);
  },

  async update(id, data) {
    const current = await equipmentRepository.findById(id);
    if (!current) throw new NotFoundError('Оборудование');

    // Уникальность серийного номера проверяем и при обновлении: иначе частичное
    // обновление позволило бы занять номер, который есть у другой единицы техники.
    if (data.serialNumber && data.serialNumber !== current.serialNumber) {
      const occupied = await equipmentRepository.findBySerialNumber(data.serialNumber);
      if (occupied) throw new ConflictError('Оборудование с таким серийным номером уже существует');
    }

    return equipmentRepository.update(id, data);
  },

  async remove(id) {
    if (!(await equipmentRepository.exists(id))) throw new NotFoundError('Оборудование');
    if (await requestRepository.hasOpenRequests(id)) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками');
    }
    await equipmentRepository.delete(id);
  },

  // Прогноз по координатам объекта и пригодность окна для наружных работ.
  // Недоступность внешнего API не роняем: отдаём suitable: null и причину,
  // а решение о коде ответа принимает контроллер.
  async getWeather(id) {
    const equipment = await this.getById(id);
    const forecast = await weatherService.getForecast(
      equipment.location.lat,
      equipment.location.lon,
    );

    if (!forecast.available) {
      return { equipment, forecast, suitable: null, reason: forecast.reason };
    }

    // Определяем пригодность
    const reasons = [];
    const daily = forecast.daily;

    const maxWind = Math.max(...daily.wind_speed_10m_max);
    const totalPrecip = daily.precipitation_sum.reduce((s, v) => s + v, 0);

    if (maxWind > config.maxWindSpeed) reasons.push('Сильный ветер');
    if (totalPrecip > config.maxPrecipitation) reasons.push('Осадки');

    return {
      equipment,
      forecast: daily,
      suitable: reasons.length === 0,
      reasons,
    };
  },
};
