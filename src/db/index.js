import { Sequelize } from 'sequelize';
import config from './config.js';

// Единственный экземпляр подключения на всё приложение: модели и сервисы
// импортируют его отсюда, чтобы не открывать лишние соединения.
export const sequelize = new Sequelize(config.development);
