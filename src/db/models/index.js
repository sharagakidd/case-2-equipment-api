import { sequelize } from '../index.js';
import { Site } from './site.js';
import { Equipment } from './equipment.js';
import { EquipmentPassport } from './equipmentPassport.js';
import { Technician } from './technician.js';
import { MaintenanceRequest } from './maintenanceRequest.js';
import { RequestStatusHistory } from './requestStatusHistory.js';
import { RequestAssignee } from './requestAssignee.js';

// Ассоциации навешиваются при импорте модуля — работать с моделями нужно через него.
// foreignKey указывается именем атрибута (siteId); колонка БД задана в модели через field.

Site.hasMany(Equipment, { foreignKey: 'siteId', as: 'equipment' });
Equipment.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });

Equipment.hasOne(EquipmentPassport, { foreignKey: 'equipmentId', as: 'passport' });
EquipmentPassport.belongsTo(Equipment, { foreignKey: 'equipmentId' });

Equipment.hasMany(MaintenanceRequest, { foreignKey: 'equipmentId', as: 'requests' });
MaintenanceRequest.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });

MaintenanceRequest.hasMany(RequestStatusHistory, { foreignKey: 'requestId', as: 'history' });
RequestStatusHistory.belongsTo(MaintenanceRequest, { foreignKey: 'requestId' });

MaintenanceRequest.belongsToMany(Technician, {
  through: RequestAssignee,
  foreignKey: 'requestId',
  otherKey: 'technicianId',
  as: 'assignees',
});
Technician.belongsToMany(MaintenanceRequest, {
  through: RequestAssignee,
  foreignKey: 'technicianId',
  otherKey: 'requestId',
  as: 'requests',
});

// Удобно для сидов и обхода всех моделей в цикле.
const models = {
  Site,
  Equipment,
  EquipmentPassport,
  Technician,
  MaintenanceRequest,
  RequestStatusHistory,
  RequestAssignee,
};

export {
  Site,
  Equipment,
  EquipmentPassport,
  Technician,
  MaintenanceRequest,
  RequestStatusHistory,
  RequestAssignee,
  sequelize,
  models,
};
