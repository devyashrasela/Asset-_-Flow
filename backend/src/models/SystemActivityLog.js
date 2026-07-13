import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const SystemActivityLog = sequelize.define('SystemActivityLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true
  },
  action_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'System_Activity_Logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default SystemActivityLog;
