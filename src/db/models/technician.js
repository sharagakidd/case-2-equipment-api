import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Техник (technicians), миграция 04.
export class Technician extends Model {}

Technician.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    fullName: { type: DataTypes.STRING(150), field: 'full_name', allowNull: false },
    specialization: { type: DataTypes.STRING(120), allowNull: false },
    employeeNumber: {
      type: DataTypes.STRING(32),
      field: 'employee_number',
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: 'Technician',
    tableName: 'technicians',
    timestamps: true,
  },
);
