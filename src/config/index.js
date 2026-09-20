import 'dotenv/config';

// Единая точка чтения переменных окружения.
// dotenv/config выше подхватывает .env в момент импорта модуля.
export const config = {
  port: Number(process.env.PORT) || 3000,
};
