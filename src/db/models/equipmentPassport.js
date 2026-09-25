import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Паспорт оборудования (equipment_passports), миграция 03. Связь 1:1: equipment_id UNIQUE.
export class EquipmentPassport extends Model {}

EquipmentPassport.init(
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
      unique: true,
      references: { model: 'equipment', key: 'id' },
      onDelete: 'CASCADE',
    },
    manufacturer: { type: DataTypes.STRING(120), allowNull: false },
    model: { type: DataTypes.STRING(120), allowNull: false },
    ratedPower: { type: DataTypes.DECIMAL(10, 2), field: 'rated_power', allowNull: true },
    lastInspectionAt: {
      type: DataTypes.DATE,
      field: 'last_inspection_at',
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'EquipmentPassport',
    tableName: 'equipment_passports',
    timestamps: true,
  },
);
