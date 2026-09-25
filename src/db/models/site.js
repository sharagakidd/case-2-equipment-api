import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// Площадка (sites), миграция 01. underscored не включён: createdAt/updatedAt в БД уже camelCase.
export class Site extends Model {}

Site.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    region: { type: DataTypes.STRING(120), allowNull: false },
    lat: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
    lon: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  },
  {
    sequelize,
    modelName: 'Site',
    tableName: 'sites',
    timestamps: true,
  },
);
