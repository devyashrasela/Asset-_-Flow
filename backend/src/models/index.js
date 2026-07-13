import sequelize from '../config/db.js';

// Import models
import User from './User.js';
import Organization from './Organization.js';
import Department from './Department.js';
import OrganizationMember from './OrganizationMember.js';
import AssetCategory from './AssetCategory.js';
import Asset from './Asset.js';
import Allocation from './Allocation.js';
import Booking from './Booking.js';
import MaintenanceRequest from './MaintenanceRequest.js';
import AuditCycle from './AuditCycle.js';
import AuditItem from './AuditItem.js';
import AuditAuditor from './AuditAuditor.js';
import TransferRequest from './TransferRequest.js';
import Notification from './Notification.js';
import SystemActivityLog from './SystemActivityLog.js';

// Associations Setup

// 1. User & Organization (Ownership)
User.hasMany(Organization, { foreignKey: 'created_by', as: 'CreatedOrganizations', onDelete: 'SET NULL' });
Organization.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });

// 2. Department
Organization.hasMany(Department, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
Department.belongsTo(Organization, { foreignKey: 'organization_id' });

Department.belongsTo(Department, { foreignKey: 'parent_id', as: 'ParentDepartment', onDelete: 'SET NULL' });
Department.hasMany(Department, { foreignKey: 'parent_id', as: 'ChildDepartments' });

Department.belongsTo(User, { foreignKey: 'head_user_id', as: 'HeadUser', onDelete: 'SET NULL' });

// 3. Organization Members (Many-to-Many Bridge)
Organization.hasMany(OrganizationMember, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
OrganizationMember.belongsTo(Organization, { foreignKey: 'organization_id' });

User.hasMany(OrganizationMember, { foreignKey: 'user_id', onDelete: 'CASCADE' });
OrganizationMember.belongsTo(User, { foreignKey: 'user_id' });

Department.hasMany(OrganizationMember, { foreignKey: 'department_id', onDelete: 'SET NULL' });
OrganizationMember.belongsTo(Department, { foreignKey: 'department_id' });

// 4. Asset Categories
Organization.hasMany(AssetCategory, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
AssetCategory.belongsTo(Organization, { foreignKey: 'organization_id' });

// 5. Assets
Organization.hasMany(Asset, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
Asset.belongsTo(Organization, { foreignKey: 'organization_id' });

AssetCategory.hasMany(Asset, { foreignKey: 'category_id', onDelete: 'SET NULL' });
Asset.belongsTo(AssetCategory, { foreignKey: 'category_id', as: 'Category' });

User.hasMany(Asset, { foreignKey: 'current_holder_id', onDelete: 'SET NULL' });
Asset.belongsTo(User, { foreignKey: 'current_holder_id', as: 'CurrentHolder' });

// 6. Allocations
Organization.hasMany(Allocation, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
Allocation.belongsTo(Organization, { foreignKey: 'organization_id' });

Asset.hasMany(Allocation, { foreignKey: 'asset_tag', sourceKey: 'tag', onDelete: 'CASCADE' });
Allocation.belongsTo(Asset, { foreignKey: 'asset_tag', targetKey: 'tag', as: 'Asset' });

User.hasMany(Allocation, { foreignKey: 'assigned_to_user_id', onDelete: 'CASCADE' });
Allocation.belongsTo(User, { foreignKey: 'assigned_to_user_id', as: 'User' });

// 7. Bookings
Organization.hasMany(Booking, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
Booking.belongsTo(Organization, { foreignKey: 'organization_id' });

Asset.hasMany(Booking, { foreignKey: 'asset_tag', sourceKey: 'tag', onDelete: 'CASCADE' });
Booking.belongsTo(Asset, { foreignKey: 'asset_tag', targetKey: 'tag', as: 'Asset' });

User.hasMany(Booking, { foreignKey: 'booked_by_user_id', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'booked_by_user_id', as: 'BookedBy' });
Booking.belongsTo(User, { foreignKey: 'approved_by_user_id', as: 'ApprovedBy' });
Booking.belongsTo(User, { foreignKey: 'rejected_by_user_id', as: 'RejectedBy' });

// 8. Maintenance Requests
Organization.hasMany(MaintenanceRequest, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
MaintenanceRequest.belongsTo(Organization, { foreignKey: 'organization_id' });

Asset.hasMany(MaintenanceRequest, { foreignKey: 'asset_tag', sourceKey: 'tag', onDelete: 'CASCADE' });
MaintenanceRequest.belongsTo(Asset, { foreignKey: 'asset_tag', targetKey: 'tag', as: 'Asset' });

User.hasMany(MaintenanceRequest, { foreignKey: 'raised_by_user_id', onDelete: 'CASCADE' });
MaintenanceRequest.belongsTo(User, { foreignKey: 'raised_by_user_id', as: 'RaisedBy' });

// 9. Audit Cycles & Items
Organization.hasMany(AuditCycle, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
AuditCycle.belongsTo(Organization, { foreignKey: 'organization_id' });

Department.hasMany(AuditCycle, { foreignKey: 'target_department_id', onDelete: 'CASCADE' });
AuditCycle.belongsTo(Department, { foreignKey: 'target_department_id', as: 'TargetDepartment' });

AuditCycle.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
AuditCycle.belongsTo(User, { foreignKey: 'closed_by', as: 'ClosedBy' });

AuditCycle.hasMany(AuditAuditor, { foreignKey: 'audit_cycle_id', as: 'Auditors' });
AuditAuditor.belongsTo(AuditCycle, { foreignKey: 'audit_cycle_id' });
AuditAuditor.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

AuditCycle.hasMany(AuditItem, { foreignKey: 'audit_cycle_id', onDelete: 'CASCADE' });
AuditItem.belongsTo(AuditCycle, { foreignKey: 'audit_cycle_id' });

Asset.hasMany(AuditItem, { foreignKey: 'asset_tag', sourceKey: 'tag', onDelete: 'CASCADE' });
AuditItem.belongsTo(Asset, { foreignKey: 'asset_tag', targetKey: 'tag', as: 'Asset' });

User.hasMany(AuditItem, { foreignKey: 'verified_by_user_id', onDelete: 'SET NULL' });
AuditItem.belongsTo(User, { foreignKey: 'verified_by_user_id', as: 'VerifiedBy' });

User.hasMany(AuditItem, { foreignKey: 'added_by', onDelete: 'SET NULL' });
AuditItem.belongsTo(User, { foreignKey: 'added_by', as: 'AddedBy' });

User.hasMany(AuditItem, { foreignKey: 'resolution_by', onDelete: 'SET NULL' });
AuditItem.belongsTo(User, { foreignKey: 'resolution_by', as: 'ResolvedBy' });

// 10. Transfer Requests (Plan: Asset_Transfers table)
Organization.hasMany(TransferRequest, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
TransferRequest.belongsTo(Organization, { foreignKey: 'organization_id' });

Asset.hasMany(TransferRequest, { foreignKey: 'asset_tag', sourceKey: 'tag', onDelete: 'CASCADE' });
TransferRequest.belongsTo(Asset, { foreignKey: 'asset_tag', targetKey: 'tag', as: 'Asset' });

User.hasMany(TransferRequest, { foreignKey: 'requested_by_user_id', onDelete: 'CASCADE' });
TransferRequest.belongsTo(User, { foreignKey: 'requested_by_user_id', as: 'Requester' });

User.hasMany(TransferRequest, { foreignKey: 'current_holder_id', onDelete: 'CASCADE' });
TransferRequest.belongsTo(User, { foreignKey: 'current_holder_id', as: 'CurrentHolder' });

User.hasMany(TransferRequest, { foreignKey: 'requested_new_holder_id', onDelete: 'CASCADE' });
TransferRequest.belongsTo(User, { foreignKey: 'requested_new_holder_id', as: 'RequestedNewHolder' });


// 11. Notifications
Organization.hasMany(Notification, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
Notification.belongsTo(Organization, { foreignKey: 'organization_id' });

User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

// 12. System Activity Logs
Organization.hasMany(SystemActivityLog, { foreignKey: 'organization_id', onDelete: 'CASCADE' });
SystemActivityLog.belongsTo(Organization, { foreignKey: 'organization_id' });

User.hasMany(SystemActivityLog, { foreignKey: 'user_id', onDelete: 'SET NULL' });
SystemActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

const db = {
  sequelize,
  User,
  Organization,
  Department,
  OrganizationMember,
  AssetCategory,
  Asset,
  Allocation,
  Booking,
  MaintenanceRequest,
  AuditCycle,
  AuditItem,
  AuditAuditor,
  TransferRequest,
  Notification,
  SystemActivityLog
};

export default db;
export {
  db,
  sequelize,
  User,
  Organization,
  Department,
  OrganizationMember,
  AssetCategory,
  Asset,
  Allocation,
  Booking,
  MaintenanceRequest,
  AuditCycle,
  AuditItem,
  AuditAuditor,
  TransferRequest,
  Notification,
  SystemActivityLog
};

