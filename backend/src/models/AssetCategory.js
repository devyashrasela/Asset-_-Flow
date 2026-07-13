import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const AssetCategory = sequelize.define('AssetCategory', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  custom_fields: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'Asset_Categories',
  timestamps: false
});

export default AssetCategory;
