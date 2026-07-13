import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const MaintenanceRequest = sequelize.define('MaintenanceRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  issue_description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Medium'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'In Progress', 'Resolved'),
    defaultValue: 'Pending'
  },
  photo_url: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'Maintenance_Requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default MaintenanceRequest;
