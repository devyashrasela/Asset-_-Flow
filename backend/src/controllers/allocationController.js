import { Op, literal } from 'sequelize';
import {
  sequelize, Allocation, Asset, User, OrganizationMember,
  TransferRequest, Department, MaintenanceRequest, SystemActivityLog
} from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Determine dept-scoped user IDs for Dept Head filtering.
 * Returns null if no scoping needed (Admin/Asset Manager see everything).
 */
const getDeptScopedUserIds = async (orgMember) => {
  if (['Admin', 'Asset Manager'].includes(orgMember.role) || orgMember.isOwner) {
    return null; // no scoping
  }
  if (orgMember.role === 'Department Head' && orgMember.department_id) {
    const deptMembers = await OrganizationMember.findAll({
      where: { organization_id: orgMember.organization_id, department_id: orgMember.department_id, status: 'Active' },
      attributes: ['user_id']
    });
    return deptMembers.map(m => m.user_id);
  }
  return 'self'; // Employee — own allocations only
};

// ─── GET /api/allocations ───────────────────────────────────────────────────

export const listAllocations = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { status: statusFilter, department_id, category_id, from_date, to_date } = req.query;

  try {
    const whereClause = { organization_id: orgId };

    // Role-based scoping
    const scopedIds = await getDeptScopedUserIds(req.orgMember);
    if (scopedIds === 'self') {
      whereClause.assigned_to_user_id = req.user.id;
    } else if (Array.isArray(scopedIds)) {
      whereClause.assigned_to_user_id = { [Op.in]: scopedIds };
    }

    // Filters
    if (statusFilter) whereClause.status = statusFilter;
    if (from_date || to_date) {
      whereClause.created_at = {};
      if (from_date) whereClause.created_at[Op.gte] = from_date;
      if (to_date) whereClause.created_at[Op.lte] = to_date;
    }

    const allocations = await Allocation.findAll({
      where: whereClause,
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'category_id'] },
        { model: User, as: 'User', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const parsed = allocations.map(al => {
      const isOverdue = al.status === 'Active' && al.expected_return_date && new Date(al.expected_return_date) < today;
      const isDueSoon = al.status === 'Active' && al.expected_return_date &&
        new Date(al.expected_return_date) >= today && new Date(al.expected_return_date) <= sevenDaysFromNow;
      return {
        ...al.toJSON(),
        is_overdue: !!isOverdue,
        is_due_soon: !!isDueSoon
      };
    });

    return res.json(parsed);
  } catch (err) {
    console.error('Error listing allocations:', err);
    return res.status(500).json({ error: 'Internal server error listing allocations.' });
  }
};

// ─── GET /api/allocations/my ────────────────────────────────────────────────

export const myAllocations = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const allocations = await Allocation.findAll({
      where: { organization_id: orgId, assigned_to_user_id: req.user.id },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status'] },
      ],
      order: [['created_at', 'DESC']]
    });

    const today = new Date();
    const parsed = allocations.map(al => ({
      ...al.toJSON(),
      is_overdue: al.status === 'Active' && al.expected_return_date && new Date(al.expected_return_date) < today
    }));

    return res.json(parsed);
  } catch (err) {
    console.error('Error listing my allocations:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/allocations/overdue ───────────────────────────────────────────

export const listOverdue = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const allocations = await Allocation.findAll({
      where: {
        organization_id: orgId,
        status: 'Active',
        expected_return_date: { [Op.lt]: new Date(), [Op.not]: null }
      },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name'] },
        { model: User, as: 'User', attributes: ['id', 'name', 'email'] }
      ],
      order: [['expected_return_date', 'ASC']]
    });

    return res.json(allocations);
  } catch (err) {
    console.error('Error listing overdue allocations:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/allocations/:id ───────────────────────────────────────────────

export const getAllocationDetail = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const allocationId = parseInt(req.params.id, 10);

  if (isNaN(allocationId)) {
    return res.status(400).json({ error: 'Invalid allocation ID.' });
  }

  try {
    const allocation = await Allocation.findOne({
      where: { id: allocationId, organization_id: orgId },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'category_id', 'photo_url', 'condition'] },
        { model: User, as: 'User', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    // Timeline: activity logs related to this asset tag
    const timeline = await SystemActivityLog.findAll({
      where: {
        organization_id: orgId,
        description: { [Op.like]: `%${allocation.asset_tag}%` }
      },
      include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const today = new Date();
    return res.json({
      ...allocation.toJSON(),
      is_overdue: allocation.status === 'Active' && allocation.expected_return_date && new Date(allocation.expected_return_date) < today,
      timeline
    });
  } catch (err) {
    console.error('Error fetching allocation detail:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/allocations/asset/:tag/history ────────────────────────────────

export const getAssetAllocationHistory = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const allocations = await Allocation.findAll({
      where: { organization_id: orgId, asset_tag: tag },
      include: [
        { model: User, as: 'User', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.json(allocations);
  } catch (err) {
    console.error('Error fetching asset allocation history:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── POST /api/allocations (Multi-Asset with FOR UPDATE) ────────────────────

export const allocateAsset = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { asset_tags, assigned_to_user_id, expected_return_date, notes } = req.body;

  // Support both single tag (legacy) and multi-tag
  const tags = asset_tags || (req.body.asset_tag ? [req.body.asset_tag] : null);

  if (!tags || tags.length === 0 || !assigned_to_user_id) {
    return res.status(400).json({ error: 'At least one asset tag and assigned user ID are required.' });
  }

  const transaction = await sequelize.transaction();
  try {
    // 1. Verify user membership
    const member = await OrganizationMember.findOne({
      where: { user_id: assigned_to_user_id, organization_id: orgId, status: 'Active' },
      transaction
    });
    if (!member) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Selected user is not an active member of this workspace.' });
    }

    // 2. Acquire row-level locks on all requested asset tags (FOR UPDATE)
    const assets = await Asset.findAll({
      where: { tag: { [Op.in]: tags }, organization_id: orgId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (assets.length !== tags.length) {
      const foundTags = assets.map(a => a.tag);
      const missing = tags.filter(t => !foundTags.includes(t));
      await transaction.rollback();
      return res.status(404).json({ error: `Assets not found: ${missing.join(', ')}` });
    }

    // 3. Conflict check — separate unavailable assets by reason
    const conflicts = [];
    const unavailable = [];

    for (const asset of assets) {
      if (asset.status === 'Allocated' || asset.status === 'Reserved') {
        const holder = asset.current_holder_id
          ? await User.findByPk(asset.current_holder_id, { attributes: ['id', 'name'], transaction })
          : null;
        conflicts.push({
          asset_tag: asset.tag,
          asset_name: asset.name,
          error_code: 'ASSET_ALREADY_ALLOCATED',
          current_holder_name: holder ? holder.name : 'Unknown',
          current_holder_id: asset.current_holder_id,
          expected_return_date: null, // could query active allocation
          transfer_request_eligible: true
        });
      } else if (['Under Maintenance', 'Lost', 'Retired', 'Disposed'].includes(asset.status)) {
        unavailable.push({
          asset_tag: asset.tag,
          asset_name: asset.name,
          reason: `Asset is ${asset.status}`
        });
      }
    }

    if (conflicts.length > 0 || unavailable.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        error: 'One or more assets are not available for allocation.',
        conflicts,
        unavailable
      });
    }

    // 4. All assets available — create allocation records
    const createdAllocations = [];
    for (const asset of assets) {
      const alloc = await Allocation.create({
        organization_id: orgId,
        asset_tag: asset.tag,
        assigned_to_user_id,
        expected_return_date: expected_return_date || null,
        status: 'Active',
        notes: notes || null
      }, { transaction });
      createdAllocations.push(alloc);

      // Update asset status and holder
      asset.status = 'Allocated';
      asset.current_holder_id = assigned_to_user_id;
      await asset.save({ transaction });
    }

    await transaction.commit();

    // Log and notify (outside transaction for performance)
    const assignedUser = await User.findByPk(assigned_to_user_id, { attributes: ['name'] });
    const userName = assignedUser ? assignedUser.name : `User #${assigned_to_user_id}`;

    for (const asset of assets) {
      await logActivity(orgId, req.user.id, 'ASSET_ALLOCATED', `Allocated '${asset.name}' (${asset.tag}) to ${userName}`);
    }
    await createNotification(orgId, assigned_to_user_id, 'Assets Assigned', `${tags.length} asset(s) have been allocated to you.`);

    return res.status(201).json({
      message: `${tags.length} asset(s) allocated successfully.`,
      allocations: createdAllocations
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error allocating asset:', err);
    return res.status(500).json({ error: 'Internal server error during asset allocation.' });
  }
};

// ─── PATCH /api/allocations/:id/return ──────────────────────────────────────

export const returnAsset = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const allocationId = parseInt(req.params.id, 10);
  const {
    return_date,
    condition,        // 'Good' | 'Minor Wear' | 'Damaged'
    checkin_notes,
    trigger_maintenance // boolean
  } = req.body;

  if (isNaN(allocationId)) {
    return res.status(400).json({ error: 'Invalid allocation ID.' });
  }

  if (!condition) {
    return res.status(400).json({ error: 'Return condition is required (Good / Minor Wear / Damaged).' });
  }

  const transaction = await sequelize.transaction();
  try {
    const allocation = await Allocation.findOne({
      where: { id: allocationId, organization_id: orgId, status: 'Active' },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!allocation) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Active allocation record not found.' });
    }

    // Close allocation
    allocation.status = 'Returned';
    allocation.return_condition = condition;
    allocation.notes = checkin_notes || null;
    await allocation.save({ transaction });

    // Revert asset
    const asset = await Asset.findOne({
      where: { tag: allocation.asset_tag, organization_id: orgId },
      transaction
    });

    if (asset) {
      asset.status = 'Available';
      asset.current_holder_id = null;
      asset.condition = condition;
      await asset.save({ transaction });
    }

    // Auto-create maintenance request if triggered and condition is Damaged
    if (trigger_maintenance && condition === 'Damaged' && asset) {
      await MaintenanceRequest.create({
        organization_id: orgId,
        asset_tag: allocation.asset_tag,
        raised_by_user_id: req.user.id,
        issue_description: `Auto-created from return check-in: ${checkin_notes || 'Asset returned damaged'}`,
        status: 'Pending',
        priority: 'High'
      }, { transaction });

      await logActivity(orgId, req.user.id, 'MAINTENANCE_REQUESTED',
        `Auto-created maintenance request for '${asset.name}' (${asset.tag})`);
    }

    await transaction.commit();

    // Log and notify
    const holderName = await User.findByPk(allocation.assigned_to_user_id, { attributes: ['name'] });
    await logActivity(orgId, req.user.id, 'ASSET_RETURNED',
      `Returned '${asset?.name}' (${allocation.asset_tag}) from ${holderName?.name || 'user'} — Condition: ${condition}. Notes: ${checkin_notes || 'N/A'}`);
    await createNotification(orgId, allocation.assigned_to_user_id, 'Asset Return Processed',
      `Your return of asset ${allocation.asset_tag} has been processed. Condition: ${condition}.`);

    return res.json({ message: 'Asset return processed successfully.' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error returning asset:', err);
    return res.status(500).json({ error: 'Internal server error processing return.' });
  }
};

// ─── POST /api/allocations/transfers ────────────────────────────────────────

export const requestTransfer = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { asset_tag, requested_new_holder_id, reason, urgency } = req.body;

  if (!asset_tag || !requested_new_holder_id || !reason) {
    return res.status(400).json({ error: 'Asset tag, requested new holder, and reason are required.' });
  }

  try {
    const asset = await Asset.findOne({
      where: { tag: asset_tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    if (asset.status !== 'Allocated' && asset.status !== 'Available') {
      return res.status(400).json({ error: 'This asset is not Available or Allocated, hence cannot be requested.' });
    }

    if (asset.current_holder_id === requested_new_holder_id) {
      return res.status(400).json({ error: 'Asset is already held by this user.' });
    }

    // Verify new holder is an active member
    const newHolderMember = await OrganizationMember.findOne({
      where: { user_id: requested_new_holder_id, organization_id: orgId, status: 'Active' }
    });
    if (!newHolderMember) {
      return res.status(400).json({ error: 'Requested new holder is not an active member of this workspace.' });
    }

    const transfer = await TransferRequest.create({
      organization_id: orgId,
      asset_tag,
      current_holder_id: asset.current_holder_id,
      requested_new_holder_id,
      requested_by_user_id: req.user.id,
      reason,
      urgency: urgency || 'Normal',
      status: 'Pending'
    });

    const currentHolder = await User.findByPk(asset.current_holder_id, { attributes: ['name'] });
    const newHolder = await User.findByPk(requested_new_holder_id, { attributes: ['name'] });

    await logActivity(orgId, req.user.id, 'TRANSFER_REQUESTED',
      `Transfer requested for '${asset.name}' (${asset_tag}): from ${currentHolder?.name} to ${newHolder?.name}`);

    // Notify Asset Managers + Dept Head
    const managers = await OrganizationMember.findAll({
      where: { organization_id: orgId, role: { [Op.in]: ['Asset Manager', 'Admin'] }, status: 'Active' }
    });
    for (const mgr of managers) {
      await createNotification(orgId, mgr.user_id, 'Transfer Request',
        `Transfer requested for ${asset.name} (${asset_tag}) — ${urgency || 'Normal'} priority.`);
    }

    return res.status(201).json({
      message: 'Transfer request submitted successfully.',
      transfer_request: transfer
    });
  } catch (err) {
    console.error('Error raising transfer request:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/allocations/transfers ─────────────────────────────────────────

export const listTransfers = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const whereClause = { organization_id: orgId };

    // Dept Head scoping
    if (req.orgMember.role === 'Department Head' && req.orgMember.department_id) {
      const deptMembers = await OrganizationMember.findAll({
        where: { organization_id: orgId, department_id: req.orgMember.department_id, status: 'Active' },
        attributes: ['user_id']
      });
      const deptUserIds = deptMembers.map(m => m.user_id);
      whereClause.current_holder_id = { [Op.in]: deptUserIds };
    } else if (req.orgMember.role === 'Employee') {
      whereClause[Op.or] = [
        { requested_by_user_id: req.user.id },
        { requested_new_holder_id: req.user.id }
      ];
    }

    const transfers = await TransferRequest.findAll({
      where: whereClause,
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name'] },
        { model: User, as: 'Requester', attributes: ['id', 'name'] },
        { model: User, as: 'CurrentHolder', attributes: ['id', 'name'] },
        { model: User, as: 'RequestedNewHolder', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.json(transfers);
  } catch (err) {
    console.error('Error listing transfer requests:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── PATCH /api/allocations/transfers/:id/approve ───────────────────────────

export const approveTransfer = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const transferId = parseInt(req.params.id, 10);

  if (isNaN(transferId)) {
    return res.status(400).json({ error: 'Invalid transfer ID.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const request = await TransferRequest.findOne({
      where: { id: transferId, organization_id: orgId, status: 'Pending' },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Pending transfer request not found.' });
    }

    // Verify asset still allocated
    const asset = await Asset.findOne({
      where: { tag: request.asset_tag, organization_id: orgId },
      transaction
    });

    if (!asset || (asset.status !== 'Allocated' && asset.status !== 'Available')) {
      request.status = 'Rejected';
      await request.save({ transaction });
      await transaction.commit();
      return res.status(409).json({ error: 'Asset is no longer Available or Allocated. Request auto-rejected.' });
    }

    // Close current allocation if it was a transfer
    if (asset.status === 'Allocated') {
      const activeAlloc = await Allocation.findOne({
        where: { asset_tag: request.asset_tag, organization_id: orgId, status: 'Active' },
        transaction
      });
      if (activeAlloc) {
        activeAlloc.status = 'Returned';
        activeAlloc.notes = 'Closed via approved transfer';
        await activeAlloc.save({ transaction });
      }
    }

    // Create new allocation for new holder
    await Allocation.create({
      organization_id: orgId,
      asset_tag: request.asset_tag,
      assigned_to_user_id: request.requested_new_holder_id,
      expected_return_date: null,
      status: 'Active',
      notes: asset.status === 'Allocated' ? 'Received via approved transfer' : 'Allocated via approved request'
    }, { transaction });

    // Update asset holder and status
    asset.status = 'Allocated';
    asset.current_holder_id = request.requested_new_holder_id;
    await asset.save({ transaction });

    // Update transfer status
    request.status = 'Approved';
    await request.save({ transaction });

    // Auto-reject other pending transfers for same asset
    await TransferRequest.update(
      { status: 'Rejected' },
      {
        where: {
          organization_id: orgId,
          asset_tag: request.asset_tag,
          status: 'Pending',
          id: { [Op.ne]: transferId }
        },
        transaction
      }
    );

    await transaction.commit();

    const oldHolder = await User.findByPk(request.current_holder_id, { attributes: ['name'] });
    const newHolder = await User.findByPk(request.requested_new_holder_id, { attributes: ['name'] });

    await logActivity(orgId, req.user.id, 'TRANSFER_APPROVED',
      `Transfer approved for '${asset.name}' (${request.asset_tag}): from ${oldHolder?.name} to ${newHolder?.name}`);
    await createNotification(orgId, request.requested_by_user_id, 'Transfer Approved',
      `Your transfer request for ${request.asset_tag} has been approved.`);
    await createNotification(orgId, request.requested_new_holder_id, 'Asset Transferred to You',
      `Asset ${asset.name} (${request.asset_tag}) is now allocated to you.`);

    return res.json({ message: 'Transfer approved and asset re-allocated.' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error approving transfer:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── PATCH /api/allocations/transfers/:id/reject ────────────────────────────

export const rejectTransfer = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const transferId = parseInt(req.params.id, 10);
  const { reason: rejectReason } = req.body;

  if (isNaN(transferId)) {
    return res.status(400).json({ error: 'Invalid transfer ID.' });
  }

  try {
    const request = await TransferRequest.findOne({
      where: { id: transferId, organization_id: orgId, status: 'Pending' }
    });

    if (!request) {
      return res.status(404).json({ error: 'Pending transfer request not found.' });
    }

    request.status = 'Rejected';
    await request.save();

    await logActivity(orgId, req.user.id, 'TRANSFER_REJECTED',
      `Transfer rejected for asset ${request.asset_tag}${rejectReason ? ': ' + rejectReason : ''}`);
    await createNotification(orgId, request.requested_by_user_id, 'Transfer Rejected',
      `Your transfer request for ${request.asset_tag} has been rejected.${rejectReason ? ' Reason: ' + rejectReason : ''}`);

    return res.json({ message: 'Transfer request rejected.' });
  } catch (err) {
    console.error('Error rejecting transfer:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
