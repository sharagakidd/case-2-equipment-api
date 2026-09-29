import { EquipmentRepository } from './EquipmentRepository.js';
import { ReportRepository } from './ReportRepository.js';
import { RequestRepository } from './RequestRepository.js';
import { SiteRepository } from './SiteRepository.js';
import { TechnicianRepository } from './TechnicianRepository.js';
import { UserRepository } from './UserRepository.js';

// Одиночные экземпляры репозиториев на всё приложение, подключение к БД общее.
export const equipmentRepository = new EquipmentRepository();
export const reportRepository = new ReportRepository();
export const requestRepository = new RequestRepository();
export const siteRepository = new SiteRepository();
export const technicianRepository = new TechnicianRepository();
export const userRepository = new UserRepository();
