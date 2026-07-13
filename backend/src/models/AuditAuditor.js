import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const AuditAuditor = sequelize.define('AuditAuditor', {
  audit_cycle_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  assigned_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  assigned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Audit_Auditors',
  timestamps: false
});

export default AuditAuditor;
