import { EquipmentRepository } from './EquipmentRepository.js';
import { RequestRepository } from './RequestRepository.js';

// Единственные экземпляры репозиториев на всё приложение: сервисы и контроллеры
// импортируют отсюда готовые объекты, поэтому данные видны всем слоям сразу.
export const equipmentRepository = new EquipmentRepository();
export const requestRepository = new RequestRepository();
