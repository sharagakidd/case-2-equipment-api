import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Оборудование (equipment), миграция 02. Атрибуты camelCase, колонки БД заданы через field.
export class Equipment extends Model {}

Equipment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    siteId: {
      type: DataTypes.UUID,
      field: 'site_id',
      allowNull: true,
      references: { model: 'sites', key: 'id' },
      onDelete: 'RESTRICT',
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    type: {
      type: DataTypes.ENUM('turbine', 'inverter', 'sensor', 'substation'),
      allowNull: false,
    },
    serialNumber: {
      type: DataTypes.STRING(64),
      field: 'serial_number',
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('operational', 'maintenance', 'fault', 'decommissioned'),
      allowNull: false,
      defaultValue: 'operational',
    },
    installedAt: { type: DataTypes.DATE, field: 'installed_at', allowNull: true },
    // DECIMAL драйвер pg отдаёт строкой — приведение к number на слое репозитория.
    lat: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
    lon: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  },
  {
    sequelize,
    modelName: 'Equipment',
    tableName: 'equipment',
    timestamps: true,
  },
);
