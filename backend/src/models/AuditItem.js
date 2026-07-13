import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const AuditItem = sequelize.define('AuditItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  verification_status: {
    type: DataTypes.ENUM('Pending', 'Verified', 'Missing', 'Damaged'),
    defaultValue: 'Pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  discrepancy_resolution: {
    type: DataTypes.ENUM('Confirmed', 'Dismissed'),
    allowNull: true
  },
  resolution_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  added_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Audit_Items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default AuditItem;
