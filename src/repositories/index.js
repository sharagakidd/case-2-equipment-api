import { EquipmentRepository } from './EquipmentRepository.js';
import { RequestRepository } from './RequestRepository.js';
import { SiteRepository } from './SiteRepository.js';

// Единственные экземпляры репозиториев на всё приложение: сервисы импортируют
// отсюда готовые объекты, поэтому подключение к БД (src/db/index.js) общее.
export const equipmentRepository = new EquipmentRepository();
export const requestRepository = new RequestRepository();
export const siteRepository = new SiteRepository();
