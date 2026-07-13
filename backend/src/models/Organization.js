import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'Organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default Organization;
