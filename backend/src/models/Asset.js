import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Asset = sequelize.define('Asset', {
  tag: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_shared_resource: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed'),
    defaultValue: 'Available'
  },
  serial_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  acquisition_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  acquisition_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  photo_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  custom_values: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'Assets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default Asset;
