import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const OrganizationMember = sequelize.define('OrganizationMember', {
  organization_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('Employee', 'Department Head', 'Asset Manager', 'Admin'),
    defaultValue: 'Employee',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
    allowNull: false
  }
}, {
  tableName: 'Organization_Members',
  timestamps: false
});

export default OrganizationMember;
