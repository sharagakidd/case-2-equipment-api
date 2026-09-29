import 'dotenv/config';

// Единая точка чтения переменных окружения (dotenv подхватывает .env при импорте).
// Без обязательных переменных падаем сразу на старте, а не в первом запросе.
const REQUIRED_ENV_VARS = [
  'CORS_ORIGINS',
  'WEATHER_API_URL',
  'FORECAST_API_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]) {
    throw new Error(`Не задана обязательная переменная окружения: ${name}`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,

  // Список origin'ов для cors: "http://a,http://b" -> ['http://a', 'http://b'].
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Внешний API погоды (Open-Meteo): сначала геокодинг города, потом прогноз.
  weatherApiUrl: process.env.WEATHER_API_URL,
  forecastApiUrl: process.env.FORECAST_API_URL,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 5000,

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },

  // Порог, ниже которого технику считаем пригодной к работе.
  maxWindSpeed: Number(process.env.MAX_WIND_SPEED) || 10,
  maxPrecipitation: Number(process.env.MAX_PRECIPITATION) || 0,

  // Отдельный лимит на вход: 5 попыток за 15 минут с одного адреса.
  // Общий лимит приложения (100 запросов в минуту) продолжает действовать для остальных.
  auth: {
    loginRateLimit: {
      windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    },
  },

  isProduction: nodeEnv === 'production',
};
