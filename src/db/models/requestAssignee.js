import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Исполнитель заявки (request_assignees), миграция 07: пара (request_id, technician_id) UNIQUE.
export class RequestAssignee extends Model {}

RequestAssignee.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    requestId: {
      type: DataTypes.UUID,
      field: 'request_id',
      allowNull: false,
      references: { model: 'maintenance_requests', key: 'id' },
      onDelete: 'CASCADE',
    },
    technicianId: {
      type: DataTypes.UUID,
      field: 'technician_id',
      allowNull: false,
      references: { model: 'technicians', key: 'id' },
      onDelete: 'RESTRICT',
    },
    role: {
      type: DataTypes.ENUM('lead', 'member'),
      allowNull: false,
    },
    hours: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  },
  {
    sequelize,
    modelName: 'RequestAssignee',
    tableName: 'request_assignees',
    timestamps: false,
  },
);
