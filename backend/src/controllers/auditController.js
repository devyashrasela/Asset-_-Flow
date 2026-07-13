import { Op } from 'sequelize';
import { sequelize, AuditCycle, AuditItem, AuditAuditor, Asset, Department, User, OrganizationMember } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

// --- Helpers ---

const isAdminOrManager = (role) => ['Admin', 'Asset Manager'].includes(role);

const isAssignedAuditor = async (cycleId, userId) => {
  const row = await AuditAuditor.findOne({ where: { audit_cycle_id: cycleId, user_id: userId } });
  return !!row;
};

// --- Cycles ---

export const listCycles = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const cycles = await AuditCycle.findAll({
      where: { organization_id: orgId },
      include: [
        { model: Department, as: 'TargetDepartment', attributes: ['id', 'name'] },
        {
          model: AuditAuditor,
          as: 'Auditors',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }]
        }
      ],
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM Audit_Items WHERE Audit_Items.audit_cycle_id = AuditCycle.id)'), 'item_count'],
          [sequelize.literal('(SELECT COUNT(*) FROM Audit_Items WHERE Audit_Items.audit_cycle_id = AuditCycle.id AND Audit_Items.verification_status != \'Pending\')'), 'verified_count']
        ]
      },
      order: [['created_at', 'DESC']]
    });
    return res.json(cycles);
  } catch (err) {
    console.error('Error fetching audit cycles:', err);
    return res.status(500).json({ error: 'Internal server error fetching audits.' });
  }
};

export const getCycleDetails = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const cycleId = parseInt(req.params.id, 10);

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  try {
    // Access check: Admin/Asset Manager always, Employee only if assigned auditor
    if (!isAdminOrManager(role)) {
      const assigned = await isAssignedAuditor(cycleId, req.user.id);
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied. You are not an assigned auditor for this cycle.' });
      }
    }

    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId },
      include: [
        { model: Department, as: 'TargetDepartment', attributes: ['id', 'name'] },
        { model: User, as: 'CreatedBy', attributes: ['id', 'name'] },
        { model: User, as: 'ClosedBy', attributes: ['id', 'name'] }
      ]
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    const items = await AuditItem.findAll({
      where: { audit_cycle_id: cycleId },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'current_holder_id'] },
        { model: User, as: 'VerifiedBy', attributes: ['id', 'name'] },
        { model: User, as: 'AddedBy', attributes: ['id', 'name'] },
        { model: User, as: 'ResolvedBy', attributes: ['id', 'name'] }
      ]
    });

    const auditors = await AuditAuditor.findAll({
      where: { audit_cycle_id: cycleId },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }]
    });

    return res.json({
      ...cycle.toJSON(),
      items,
      auditors
    });
  } catch (err) {
    console.error('Error fetching audit cycle details:', err);
    return res.status(500).json({ error: 'Internal server error fetching details.' });
  }
};

export const createCycle = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { name, target_department_id, start_date, end_date } = req.body;
  const targetDeptId = target_department_id || req.body.department_id;

  if (!name || !targetDeptId || !start_date || !end_date) {
    return res.status(400).json({ error: 'Name, target department ID, start date, and end date are required.' });
  }

  // Prevent past dates
  const todayStr = new Date().toISOString().split('T')[0];
  if (start_date < todayStr) {
    return res.status(400).json({ error: 'Start date cannot be in the past.' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after the start date.' });
  }

  try {
    const dept = await Department.findOne({
      where: { id: targetDeptId, organization_id: orgId }
    });
    if (!dept) {
      return res.status(400).json({ error: 'Target department not found in this organization.' });
    }

    const cycle = await AuditCycle.create({
      organization_id: orgId,
      name,
      target_department_id: targetDeptId,
      start_date,
      end_date,
      status: 'Draft',
      created_by: req.user.id
    });

    await logActivity(orgId, req.user.id, 'AUDIT_CYCLE_CREATED', `Created audit cycle: ${name} (ID: ${cycle.id})`);

    return res.status(201).json({
      message: 'Audit cycle created as Draft.',
      audit_cycle: cycle
    });
  } catch (err) {
    console.error('Error creating audit cycle:', err);
    return res.status(500).json({ error: 'Internal server error creating audit cycle.' });
  }
};

export const activateCycle = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const cycleId = parseInt(req.params.id, 10);

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  try {
    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (cycle.status !== 'Draft') {
      return res.status(400).json({ error: `Cannot activate. Cycle is currently '${cycle.status}'.` });
    }

    cycle.status = 'Active';
    await cycle.save();

    await logActivity(orgId, req.user.id, 'AUDIT_CYCLE_ACTIVATED', `Activated audit cycle ID: ${cycleId}`);

    return res.json({ message: 'Audit cycle activated.' });
  } catch (err) {
    console.error('Error activating audit cycle:', err);
    return res.status(500).json({ error: 'Internal server error activating audit cycle.' });
  }
};

// --- Auditors ---

export const assignAuditors = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const cycleId = parseInt(req.params.id, 10);
  const { user_ids } = req.body;

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'user_ids array is required.' });
  }

  try {
    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (!['Draft', 'Active'].includes(cycle.status)) {
      return res.status(400).json({ error: 'Can only assign auditors to Draft or Active cycles.' });
    }

    // Validate each user is an active org member
    const members = await OrganizationMember.findAll({
      where: { organization_id: orgId, user_id: { [Op.in]: user_ids }, status: 'Active' },
      attributes: ['user_id']
    });
    const validUserIds = members.map(m => m.user_id);
    const invalidIds = user_ids.filter(id => !validUserIds.includes(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({ error: `Users not active org members: ${invalidIds.join(', ')}` });
    }

    // Get existing to skip duplicates
    const existing = await AuditAuditor.findAll({
      where: { audit_cycle_id: cycleId, user_id: { [Op.in]: validUserIds } },
      attributes: ['user_id']
    });
    const existingIds = existing.map(e => e.user_id);
    const newIds = validUserIds.filter(id => !existingIds.includes(id));

    if (newIds.length > 0) {
      const rows = newIds.map(uid => ({
        audit_cycle_id: cycleId,
        user_id: uid,
        assigned_by: req.user.id
      }));
      await AuditAuditor.bulkCreate(rows);
    }

    await logActivity(orgId, req.user.id, 'AUDIT_AUDITORS_ASSIGNED', `Assigned ${newIds.length} auditor(s) to cycle ${cycleId}`);

    return res.json({
      message: `${newIds.length} auditor(s) assigned. ${existingIds.length} already existed.`,
      assigned: newIds,
      skipped: existingIds
    });
  } catch (err) {
    console.error('Error assigning auditors:', err);
    return res.status(500).json({ error: 'Internal server error assigning auditors.' });
  }
};

export const removeAuditor = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const cycleId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);

  if (isNaN(cycleId) || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  try {
    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (!['Draft', 'Active'].includes(cycle.status)) {
      return res.status(400).json({ error: 'Can only remove auditors from Draft or Active cycles.' });
    }

    const deleted = await AuditAuditor.destroy({
      where: { audit_cycle_id: cycleId, user_id: userId }
    });

    if (deleted === 0) {
      return res.status(404).json({ error: 'Auditor assignment not found.' });
    }

    await logActivity(orgId, req.user.id, 'AUDIT_AUDITOR_REMOVED', `Removed auditor ${userId} from cycle ${cycleId}`);

    return res.json({ message: 'Auditor removed.' });
  } catch (err) {
    console.error('Error removing auditor:', err);
    return res.status(500).json({ error: 'Internal server error removing auditor.' });
  }
};

// --- Items ---

export const addItem = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const cycleId = parseInt(req.params.id, 10);
  const { asset_tag } = req.body;

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  if (!asset_tag) {
    return res.status(400).json({ error: 'asset_tag is required.' });
  }

  try {
    // Access check
    if (!isAdminOrManager(role)) {
      const assigned = await isAssignedAuditor(cycleId, req.user.id);
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (!['Draft', 'Active'].includes(cycle.status)) {
      return res.status(400).json({ error: 'Can only add items to Draft or Active cycles.' });
    }

    const asset = await Asset.findOne({
      where: { tag: asset_tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(400).json({ error: `Asset '${asset_tag}' not found in this organization.` });
    }

    const existing = await AuditItem.findOne({
      where: { audit_cycle_id: cycleId, asset_tag }
    });

    if (existing) {
      return res.status(409).json({ error: `Asset '${asset_tag}' is already in this cycle.` });
    }

    const item = await AuditItem.create({
      audit_cycle_id: cycleId,
      asset_tag,
      verification_status: 'Pending',
      added_by: req.user.id
    });

    return res.status(201).json({ message: 'Item added.', item });
  } catch (err) {
    console.error('Error adding audit item:', err);
    return res.status(500).json({ error: 'Internal server error adding item.' });
  }
};

export const bulkAddItems = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const cycleId = parseInt(req.params.id, 10);
  const { asset_tags } = req.body;

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  if (!Array.isArray(asset_tags) || asset_tags.length === 0) {
    return res.status(400).json({ error: 'asset_tags array is required.' });
  }

  try {
    // Access check
    if (!isAdminOrManager(role)) {
      const assigned = await isAssignedAuditor(cycleId, req.user.id);
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (!['Draft', 'Active'].includes(cycle.status)) {
      return res.status(400).json({ error: 'Can only add items to Draft or Active cycles.' });
    }

    // Validate all tags at once
    const assets = await Asset.findAll({
      where: { tag: { [Op.in]: asset_tags }, organization_id: orgId },
      attributes: ['tag']
    });
    const validTags = assets.map(a => a.tag);

    const existingItems = await AuditItem.findAll({
      where: { audit_cycle_id: cycleId, asset_tag: { [Op.in]: validTags } },
      attributes: ['asset_tag']
    });
    const existingTags = existingItems.map(i => i.asset_tag);

    const errors = [];
    const toCreate = [];

    for (const tag of asset_tags) {
      if (!validTags.includes(tag)) {
        errors.push({ asset_tag: tag, reason: 'Asset not found in organization' });
      } else if (existingTags.includes(tag)) {
        errors.push({ asset_tag: tag, reason: 'Already in cycle' });
      } else {
        toCreate.push({
          audit_cycle_id: cycleId,
          asset_tag: tag,
          verification_status: 'Pending',
          added_by: req.user.id
        });
      }
    }

    let created = [];
    if (toCreate.length > 0) {
      created = await AuditItem.bulkCreate(toCreate);
    }

    return res.status(201).json({
      message: `${created.length} item(s) added.`,
      added_count: created.length,
      error_count: errors.length,
      errors
    });
  } catch (err) {
    console.error('Error bulk adding audit items:', err);
    return res.status(500).json({ error: 'Internal server error bulk adding items.' });
  }
};

export const removeItem = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const cycleId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);

  if (isNaN(cycleId) || isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  try {
    // Access check
    if (!isAdminOrManager(role)) {
      const assigned = await isAssignedAuditor(cycleId, req.user.id);
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (!['Draft', 'Active'].includes(cycle.status)) {
      return res.status(400).json({ error: 'Can only remove items from Draft or Active cycles.' });
    }

    const item = await AuditItem.findOne({
      where: { id: itemId, audit_cycle_id: cycleId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Audit item not found.' });
    }

    if (item.verification_status !== 'Pending') {
      return res.status(400).json({ error: 'Can only remove items with Pending status.' });
    }

    await item.destroy();

    return res.json({ message: 'Item removed.' });
  } catch (err) {
    console.error('Error removing audit item:', err);
    return res.status(500).json({ error: 'Internal server error removing item.' });
  }
};

// --- Verification ---

export const markVerification = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const itemId = parseInt(req.params.id, 10);
  const { verification_status, notes } = req.body;

  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID parameter.' });
  }

  const validStatuses = ['Verified', 'Missing', 'Damaged'];
  if (!validStatuses.includes(verification_status)) {
    return res.status(400).json({ error: `Invalid verification status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const item = await AuditItem.findByPk(itemId, {
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name', 'current_holder_id'] }]
    });

    if (!item) {
      return res.status(404).json({ error: 'Audit item not found.' });
    }

    const cycle = await AuditCycle.findOne({
      where: { id: item.audit_cycle_id, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (cycle.status !== 'Active') {
      return res.status(400).json({ error: 'Cycle must be Active to mark verifications.' });
    }

    // Only assigned auditors can mark
    const assigned = await isAssignedAuditor(cycle.id, req.user.id);
    if (!assigned) {
      return res.status(403).json({ error: 'Only assigned auditors can mark verifications.' });
    }

    if (item.verification_status !== 'Pending') {
      return res.status(400).json({ error: 'Item has already been verified. Cannot change.' });
    }

    // Self-audit block
    if (item.Asset && item.Asset.current_holder_id === req.user.id) {
      return res.status(403).json({ error: 'Cannot verify an asset you currently hold (self-audit block).' });
    }

    item.verification_status = verification_status;
    item.notes = notes || null;
    item.verified_by_user_id = req.user.id;
    item.verified_at = new Date();
    await item.save();

    const actionMap = {
      'Verified': 'AUDIT_ITEM_VERIFIED',
      'Missing': 'AUDIT_ITEM_MISSING',
      'Damaged': 'AUDIT_ITEM_DAMAGED'
    };

    await logActivity(orgId, req.user.id, actionMap[verification_status],
      `Marked asset ${item.asset_tag} as ${verification_status} in cycle ${cycle.id}`);

    return res.json({ message: 'Verification recorded.', item });
  } catch (err) {
    console.error('Error marking verification:', err);
    return res.status(500).json({ error: 'Internal server error marking verification.' });
  }
};

// --- Discrepancies ---

export const getDiscrepancies = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const cycleId = parseInt(req.params.id, 10);

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  try {
    // Access check
    if (!isAdminOrManager(role)) {
      const assigned = await isAssignedAuditor(cycleId, req.user.id);
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    const items = await AuditItem.findAll({
      where: {
        audit_cycle_id: cycleId,
        verification_status: { [Op.in]: ['Missing', 'Damaged'] }
      },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'current_holder_id'] },
        { model: User, as: 'VerifiedBy', attributes: ['id', 'name'] },
        { model: User, as: 'ResolvedBy', attributes: ['id', 'name'] }
      ]
    });

    return res.json(items);
  } catch (err) {
    console.error('Error fetching discrepancies:', err);
    return res.status(500).json({ error: 'Internal server error fetching discrepancies.' });
  }
};

export const resolveDiscrepancy = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const itemId = parseInt(req.params.id, 10);
  const { resolution } = req.body;

  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID parameter.' });
  }

  if (!['Confirmed', 'Dismissed'].includes(resolution)) {
    return res.status(400).json({ error: "Resolution must be 'Confirmed' or 'Dismissed'." });
  }

  try {
    const item = await AuditItem.findByPk(itemId, {
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }]
    });

    if (!item) {
      return res.status(404).json({ error: 'Audit item not found.' });
    }

    const cycle = await AuditCycle.findOne({
      where: { id: item.audit_cycle_id, organization_id: orgId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (cycle.status !== 'Active') {
      return res.status(400).json({ error: 'Cycle must be Active to resolve discrepancies.' });
    }

    if (!['Missing', 'Damaged'].includes(item.verification_status)) {
      return res.status(400).json({ error: 'Only Missing or Damaged items can be resolved.' });
    }

    item.discrepancy_resolution = resolution;
    item.resolution_by = req.user.id;
    await item.save();

    const actionType = resolution === 'Confirmed' ? 'AUDIT_DISCREPANCY_CONFIRMED' : 'AUDIT_DISCREPANCY_DISMISSED';
    await logActivity(orgId, req.user.id, actionType,
      `${resolution} discrepancy for asset ${item.asset_tag} in cycle ${cycle.id}`);

    return res.json({ message: `Discrepancy ${resolution.toLowerCase()}.`, item });
  } catch (err) {
    console.error('Error resolving discrepancy:', err);
    return res.status(500).json({ error: 'Internal server error resolving discrepancy.' });
  }
};

// --- Close ---

export const closeCycle = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const cycleId = parseInt(req.params.id, 10);

  if (isNaN(cycleId)) {
    return res.status(400).json({ error: 'Invalid cycle ID parameter.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const cycle = await AuditCycle.findOne({
      where: { id: cycleId, organization_id: orgId },
      transaction
    });

    if (!cycle) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Audit cycle not found.' });
    }

    if (cycle.status !== 'Active') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Only Active audit cycles can be closed.' });
    }

    const items = await AuditItem.findAll({
      where: { audit_cycle_id: cycleId },
      transaction
    });

    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot close cycle with no items.' });
    }

    const pendingCount = items.filter(i => i.verification_status === 'Pending').length;
    if (pendingCount > 0) {
      await transaction.rollback();
      return res.status(400).json({ error: `Cannot close cycle. ${pendingCount} item(s) still pending verification.` });
    }

    // Propagate confirmed discrepancies to asset statuses
    for (const item of items) {
      if (item.discrepancy_resolution === 'Confirmed') {
        if (item.verification_status === 'Missing') {
          await Asset.update(
            { status: 'Lost' },
            { where: { tag: item.asset_tag, organization_id: orgId }, transaction }
          );
        } else if (item.verification_status === 'Damaged') {
          await Asset.update(
            { status: 'Under Maintenance' },
            { where: { tag: item.asset_tag, organization_id: orgId }, transaction }
          );
        }
      }
    }

    cycle.status = 'Closed';
    cycle.closed_by = req.user.id;
    cycle.closed_at = new Date();
    await cycle.save({ transaction });

    await transaction.commit();

    await logActivity(orgId, req.user.id, 'AUDIT_CYCLE_CLOSED', `Closed audit cycle ID: ${cycleId}`);

    return res.json({ message: 'Audit cycle closed. Confirmed discrepancy assets updated.' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error closing audit cycle:', err);
    return res.status(500).json({ error: 'Internal server error closing audit cycle.' });
  }
};
