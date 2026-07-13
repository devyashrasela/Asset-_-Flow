import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const AuditCycle = sequelize.define('AuditCycle', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Active', 'Closed'),
    defaultValue: 'Draft'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  closed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Audit_Cycles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default AuditCycle;
