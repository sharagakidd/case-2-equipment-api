import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Заявка на обслуживание (maintenance_requests), миграция 05.
// Переходы статуса проверяет сервисный слой, история пишется в request_status_history.
export class MaintenanceRequest extends Model {}

MaintenanceRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    equipmentId: {
      type: DataTypes.UUID,
      field: 'equipment_id',
      allowNull: false,
      references: { model: 'equipment', key: 'id' },
      onDelete: 'RESTRICT',
    },
    title: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'done', 'rejected'),
      allowNull: false,
      defaultValue: 'new',
    },
    plannedAt: { type: DataTypes.DATE, field: 'planned_at', allowNull: true },
    author: { type: DataTypes.STRING(120), allowNull: true },
  },
  {
    sequelize,
    modelName: 'MaintenanceRequest',
    tableName: 'maintenance_requests',
    timestamps: true,
  },
);
