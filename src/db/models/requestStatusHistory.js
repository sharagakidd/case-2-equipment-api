import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../index.js';

// История статусов заявки (request_status_history), миграция 06.
export class RequestStatusHistory extends Model {}

RequestStatusHistory.init(
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
    // oldStatus = null у первой записи: заявка создана, перехода ещё не было.
    oldStatus: {
      type: DataTypes.ENUM('new', 'in_progress', 'done', 'rejected'),
      field: 'old_status',
      allowNull: true,
    },
    newStatus: {
      type: DataTypes.ENUM('new', 'in_progress', 'done', 'rejected'),
      field: 'new_status',
      allowNull: false,
    },
    author: { type: DataTypes.STRING(120), allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    // created_at объявлен вручную: при timestamps: true Sequelize создал бы атрибут-снейк.
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'RequestStatusHistory',
    tableName: 'request_status_history',
    timestamps: false,
  },
);
