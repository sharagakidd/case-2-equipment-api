import { config } from '../config/index.js';

// Дневные параметры, которые запрашиваем у Open-Meteo.
const DAILY_FIELDS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
];

// Сервис прогноза погоды: по координатам объекта отдаёт прогноз на несколько дней.
// Внешний API может быть недоступен — тогда метод НЕ бросает ошибку, а возвращает
// { available: false, reason }, чтобы вызывающий код отдал клиенту понятный ответ,
// а сервис не падал.
export const weatherService = {
  async getForecast(lat, lon, days = 3) {
    const url = new URL(config.forecastApiUrl);
    url.search = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      daily: DAILY_FIELDS.join(','),
      forecast_days: days,
      timezone: 'auto',
    }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return { available: false, reason: `Погодный сервис ответил ${response.status}` };
      }

      return { available: true, days: toDays(await response.json()) };
    } catch (err) {
      return {
        available: false,
        reason:
          err.name === 'AbortError'
            ? 'Превышено время ожидания погодного сервиса'
            : 'Погодный сервис недоступен',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

// Open-Meteo отдаёт прогноз параллельными массивами — разворачиваем их в дни.
function toDays(payload) {
  const daily = payload?.daily ?? {};

  return (daily.time ?? []).map((date, index) => ({
    date,
    temperatureMax: daily.temperature_2m_max?.[index] ?? null,
    temperatureMin: daily.temperature_2m_min?.[index] ?? null,
    precipitation: daily.precipitation_sum?.[index] ?? null,
    windSpeedMax: daily.wind_speed_10m_max?.[index] ?? null,
  }));
}
