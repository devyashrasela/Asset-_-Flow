import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Pending Approval', 'Upcoming', 'Ongoing', 'Completed', 'Rejected', 'Withdrawn', 'Cancelled'),
    defaultValue: 'Pending Approval'
  },
  approved_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejected_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  booked_for: {
    type: DataTypes.STRING,
    allowNull: true
  },
  booked_for_note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reminder_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'Bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default Booking;
