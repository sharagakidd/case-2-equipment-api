import { equipmentRepository, requestRepository } from '../repositories/index.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { weatherService } from './weatherService.js';
import { config } from '../config/index.js';

// Бизнес-логика оборудования: проверки уникальности и ссылочной целостности
// живут здесь, репозитории остаются «тупыми» хранилищами.
export const equipmentService = {
  getAll({ filters, sort, pagination }) {
    return equipmentRepository.findAll({ filters, sort, pagination });
  },

  getById(id) {
    const item = equipmentRepository.findById(id);
    if (!item) throw new NotFoundError('Оборудование');
    return item;
  },

  create(data) {
    const existing = equipmentRepository.findBySerialNumber(data.serialNumber);
    if (existing) throw new ConflictError('Оборудование с таким серийным номером уже существует');
    return equipmentRepository.create(data);
  },

  update(id, data) {
    const current = equipmentRepository.findById(id);
    if (!current) throw new NotFoundError('Оборудование');

    // Уникальность серийного номера проверяем и при обновлении: иначе PATCH
    // позволил бы занять номер, который уже есть у другой единицы техники.
    if (data.serialNumber && data.serialNumber !== current.serialNumber) {
      const occupied = equipmentRepository.findBySerialNumber(data.serialNumber);
      if (occupied) throw new ConflictError('Оборудование с таким серийным номером уже существует');
    }

    return equipmentRepository.update(id, data);
  },

  remove(id) {
    if (!equipmentRepository.exists(id)) throw new NotFoundError('Оборудование');
    if (requestRepository.hasOpenRequests(id)) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками');
    }
    equipmentRepository.delete(id);
  },

  // Прогноз по координатам объекта и пригодность окна для наружных работ.
  // Недоступность внешнего API не роняем: отдаём suitable: null и причину,
  // а решение о коде ответа принимает контроллер.
  async getWeather(id) {
    const equipment = this.getById(id);
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
