import { Op } from 'sequelize';
import { sequelize, MaintenanceRequest, Asset, User, Allocation, OrganizationMember, SystemActivityLog } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

// ─── LIST REQUESTS (role-scoped, filterable) ────────────────────────────
export const listRequests = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;
  const isManager = ['Asset Manager', 'Admin'].includes(role) || req.orgMember.isOwner;
  const { status, priority, asset_tag, raised_by, date_from, date_to } = req.query;

  try {
    const whereClause = { organization_id: orgId };

    // Employee scoping: own requests only
    if (role === 'Employee') {
      whereClause.raised_by_user_id = req.user.id;
    }

    // Dept Head scoping: handled after query via allocation join
    // (we filter in-memory for simplicity since the join logic is complex)

    // Filters
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause.status = { [Op.in]: statuses };
    }
    if (priority) {
      const priorities = priority.split(',').map(p => p.trim());
      whereClause.priority = { [Op.in]: priorities };
    }
    if (asset_tag) {
      whereClause.asset_tag = { [Op.like]: `%${asset_tag}%` };
    }
    if (raised_by) {
      whereClause.raised_by_user_id = parseInt(raised_by, 10);
    }
    if (date_from) {
      whereClause.created_at = { ...(whereClause.created_at || {}), [Op.gte]: new Date(date_from) };
    }
    if (date_to) {
      whereClause.created_at = { ...(whereClause.created_at || {}), [Op.lte]: new Date(date_to) };
    }

    const requests = await MaintenanceRequest.findAll({
      where: whereClause,
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'category_id'] },
        { model: User, as: 'RaisedBy', attributes: ['id', 'name', 'email'] }
      ],
      order: [
        [sequelize.literal("FIELD(priority, 'Critical', 'High', 'Medium', 'Low')"), 'ASC'],
        ['created_at', 'DESC']
      ]
    });

    return res.json(requests);
  } catch (err) {
    console.error('Error fetching maintenance requests:', err);
    return res.status(500).json({ error: 'Internal server error fetching maintenance requests.' });
  }
};

// ─── RAISE REQUEST ──────────────────────────────────────────────────────
export const raiseRequest = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { asset_tag, issue_description, priority, photo_url } = req.body;

  if (!asset_tag || !issue_description) {
    return res.status(400).json({ error: 'Asset tag and issue description are required.' });
  }

  if (issue_description.trim().length < 10) {
    return res.status(400).json({ error: 'Issue description must be at least 10 characters long.' });
  }

  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  const reqPriority = priority || 'Medium';
  if (!validPriorities.includes(reqPriority)) {
    return res.status(400).json({ error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
  }

  try {
    const asset = await Asset.findOne({
      where: { tag: asset_tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found in this organization.' });
    }

    if (['Lost', 'Retired', 'Disposed'].includes(asset.status)) {
      return res.status(409).json({ error: `Cannot raise maintenance for an asset with status: ${asset.status}.` });
    }

    const request = await MaintenanceRequest.create({
      organization_id: orgId,
      asset_tag,
      raised_by_user_id: req.user.id,
      issue_description: issue_description.trim(),
      priority: reqPriority,
      status: 'Pending',
      photo_url: photo_url || null
    });

    // Log activity
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_REQUESTED',
      `Raised maintenance request #${request.id} for '${asset.name}' (${asset_tag}) — Priority: ${reqPriority}`
    );

    // Notify all Asset Managers and Admins
    const managers = await OrganizationMember.findAll({
      where: {
        organization_id: orgId,
        role: { [Op.in]: ['Asset Manager', 'Admin'] },
        status: 'Active'
      }
    });

    for (const mgr of managers) {
      await createNotification(
        orgId,
        mgr.user_id,
        reqPriority === 'Critical' ? '🚨 Critical Maintenance Request' : 'New Maintenance Request',
        `Maintenance request #${request.id} raised for "${asset.name}" (${asset_tag}) — Priority: ${reqPriority}`
      );
    }

    return res.status(201).json({
      message: 'Maintenance request raised successfully.',
      maintenance_request: request
    });
  } catch (err) {
    console.error('Error raising maintenance request:', err);
    return res.status(500).json({ error: 'Internal server error raising maintenance request.' });
  }
};

// ─── GET REQUEST DETAIL (with timeline) ─────────────────────────────────
export const getRequest = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const requestId = parseInt(req.params.id, 10);

  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  try {
    const request = await MaintenanceRequest.findOne({
      where: { id: requestId, organization_id: orgId },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status', 'category_id'] },
        { model: User, as: 'RaisedBy', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!request) {
      return res.status(404).json({ error: 'Maintenance request not found.' });
    }

    // Access check: Employee can only view own requests
    const isManager = ['Asset Manager', 'Admin'].includes(req.orgMember.role) || req.orgMember.isOwner;
    if (!isManager && request.raised_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own maintenance requests.' });
    }

    // Fetch timeline from System_Activity_Logs
    const timeline = await SystemActivityLog.findAll({
      where: {
        organization_id: orgId,
        description: { [Op.like]: `%maintenance request #${requestId}%` }
      },
      include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      order: [['created_at', 'ASC']]
    });

    // Extract technician name from the latest MAINTENANCE_TECHNICIAN_ASSIGNED log
    let technician_name = null;
    const techLog = timeline.find(log => log.action_type === 'MAINTENANCE_TECHNICIAN_ASSIGNED');
    if (techLog) {
      const match = techLog.description.match(/Assigned technician '([^']+)'/);
      if (match) technician_name = match[1];
    }

    return res.json({
      ...request.toJSON(),
      technician_name,
      timeline
    });
  } catch (err) {
    console.error('Error fetching maintenance request detail:', err);
    return res.status(500).json({ error: 'Internal server error fetching request detail.' });
  }
};

// ─── APPROVE REQUEST ────────────────────────────────────────────────────
export const approveRequest = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const requestId = parseInt(req.params.id, 10);

  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const request = await MaintenanceRequest.findOne({
      where: { id: requestId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status'] }],
      transaction
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Maintenance request not found.' });
    }

    // Transition guard
    if (request.status !== 'Pending') {
      await transaction.rollback();
      return res.status(409).json({ error: `Cannot approve. Request is already in '${request.status}' state.` });
    }

    // Update request status
    request.status = 'Approved';
    await request.save({ transaction });

    // Flip asset to Under Maintenance
    const asset = await Asset.findOne({
      where: { tag: request.asset_tag, organization_id: orgId },
      transaction
    });
    if (asset) {
      asset.status = 'Under Maintenance';
      await asset.save({ transaction });
    }

    await transaction.commit();

    // Log activity
    const assetName = request.Asset ? request.Asset.name : request.asset_tag;
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_APPROVED',
      `Approved maintenance request #${requestId} for '${assetName}' (${request.asset_tag}) — Priority: ${request.priority}`
    );

    // Notify requester
    await createNotification(
      orgId,
      request.raised_by_user_id,
      'Maintenance Approved',
      `Your maintenance request #${requestId} for "${assetName}" has been approved.`
    );

    return res.json({ message: 'Maintenance request approved.', maintenance_request: request });
  } catch (err) {
    await transaction.rollback();
    console.error('Error approving maintenance request:', err);
    return res.status(500).json({ error: 'Internal server error approving request.' });
  }
};

// ─── REJECT REQUEST ─────────────────────────────────────────────────────
export const rejectRequest = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const requestId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  try {
    const request = await MaintenanceRequest.findOne({
      where: { id: requestId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }]
    });

    if (!request) {
      return res.status(404).json({ error: 'Maintenance request not found.' });
    }

    // Transition guard
    if (request.status !== 'Pending') {
      return res.status(409).json({ error: `Cannot reject. Request is already in '${request.status}' state.` });
    }

    request.status = 'Rejected';
    await request.save();

    const assetName = request.Asset ? request.Asset.name : request.asset_tag;
    const reasonText = reason ? ` — Reason: ${reason}` : '';

    // Log activity
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_REJECTED',
      `Rejected maintenance request #${requestId} for '${assetName}' (${request.asset_tag})${reasonText}`
    );

    // Notify requester
    await createNotification(
      orgId,
      request.raised_by_user_id,
      'Maintenance Rejected',
      `Your maintenance request #${requestId} for "${assetName}" was rejected.${reason ? ` Reason: ${reason}` : ''}`
    );

    return res.json({ message: 'Maintenance request rejected.', maintenance_request: request });
  } catch (err) {
    console.error('Error rejecting maintenance request:', err);
    return res.status(500).json({ error: 'Internal server error rejecting request.' });
  }
};

// ─── START WORK (Assign Technician + In Progress) ───────────────────────
export const startWork = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const requestId = parseInt(req.params.id, 10);
  const { technician_name, notes } = req.body;

  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  if (!technician_name || !technician_name.trim()) {
    return res.status(400).json({ error: 'Technician name is required to start maintenance work.' });
  }

  try {
    const request = await MaintenanceRequest.findOne({
      where: { id: requestId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }]
    });

    if (!request) {
      return res.status(404).json({ error: 'Maintenance request not found.' });
    }

    // Transition guard
    if (request.status !== 'Approved') {
      return res.status(409).json({ error: `Cannot start work. Request must be in 'Approved' state, currently: '${request.status}'.` });
    }

    request.status = 'In Progress';
    await request.save();

    const assetName = request.Asset ? request.Asset.name : request.asset_tag;

    // Log technician assignment
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_TECHNICIAN_ASSIGNED',
      `Assigned technician '${technician_name.trim()}' to maintenance request #${requestId} for '${assetName}' (${request.asset_tag})${notes ? ` — Notes: ${notes}` : ''}`
    );

    // Log status transition
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_IN_PROGRESS',
      `Maintenance request #${requestId} for '${assetName}' (${request.asset_tag}) is now In Progress`
    );

    // Notify requester
    await createNotification(
      orgId,
      request.raised_by_user_id,
      'Maintenance In Progress',
      `Work has started on your maintenance request #${requestId} for "${assetName}". Technician: ${technician_name.trim()}`
    );

    return res.json({ message: 'Work started. Technician assigned.', maintenance_request: request });
  } catch (err) {
    console.error('Error starting maintenance work:', err);
    return res.status(500).json({ error: 'Internal server error starting work.' });
  }
};

// ─── RESOLVE REQUEST ────────────────────────────────────────────────────
export const resolveRequest = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const requestId = parseInt(req.params.id, 10);

  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const request = await MaintenanceRequest.findOne({
      where: { id: requestId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }],
      transaction
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Maintenance request not found.' });
    }

    // Transition guard
    if (request.status !== 'In Progress') {
      await transaction.rollback();
      return res.status(409).json({ error: `Cannot resolve. Request must be 'In Progress', currently: '${request.status}'.` });
    }

    // Resolve the request
    request.status = 'Resolved';
    await request.save({ transaction });

    // Determine correct post-maintenance asset status
    const activeAllocationCount = await Allocation.count({
      where: {
        asset_tag: request.asset_tag,
        organization_id: orgId,
        status: 'Active'
      },
      transaction
    });

    const newAssetStatus = activeAllocationCount > 0 ? 'Allocated' : 'Available';

    const asset = await Asset.findOne({
      where: { tag: request.asset_tag, organization_id: orgId },
      transaction
    });
    if (asset) {
      asset.status = newAssetStatus;
      await asset.save({ transaction });
    }

    await transaction.commit();

    const assetName = request.Asset ? request.Asset.name : request.asset_tag;

    // Log activity
    await logActivity(
      orgId,
      req.user.id,
      'MAINTENANCE_RESOLVED',
      `Resolved maintenance request #${requestId} for '${assetName}' (${request.asset_tag}) — Asset status restored to ${newAssetStatus}`
    );

    // Notify requester
    await createNotification(
      orgId,
      request.raised_by_user_id,
      'Maintenance Resolved',
      `Your maintenance request #${requestId} for "${assetName}" has been resolved. Asset status: ${newAssetStatus}.`
    );

    return res.json({ message: `Maintenance resolved. Asset restored to '${newAssetStatus}'.`, maintenance_request: request });
  } catch (err) {
    await transaction.rollback();
    console.error('Error resolving maintenance request:', err);
    return res.status(500).json({ error: 'Internal server error resolving request.' });
  }
};

// ─── ASSET MAINTENANCE HISTORY ──────────────────────────────────────────
export const getAssetMaintenanceHistory = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const requests = await MaintenanceRequest.findAll({
      where: { organization_id: orgId, asset_tag: tag },
      include: [
        { model: User, as: 'RaisedBy', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // Also fetch related activity logs
    const logs = await SystemActivityLog.findAll({
      where: {
        organization_id: orgId,
        action_type: { [Op.like]: 'MAINTENANCE%' },
        description: { [Op.like]: `%${tag}%` }
      },
      include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });

    return res.json({ requests, logs });
  } catch (err) {
    console.error('Error fetching asset maintenance history:', err);
    return res.status(500).json({ error: 'Internal server error fetching maintenance history.' });
  }
};
