import { Op } from 'sequelize';
import { Asset, AssetCategory, User, Allocation, MaintenanceRequest, Booking, SystemActivityLog, OrganizationMember } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';

// Helper to enforce access controls per the Role Permissions Matrix
const checkAssetAccess = async (asset, req, orgId) => {
  const isOwner = req.orgMember.isOwner;
  const role = isOwner ? 'Admin' : req.orgMember.role;

  if (role === 'Employee') {
    return asset.current_holder_id === req.user.id;
  }

  if (role === 'Department Head') {
    if (asset.current_holder_id) {
      const holderMember = await OrganizationMember.findOne({
        where: { user_id: asset.current_holder_id, organization_id: orgId }
      });
      return holderMember && holderMember.department_id === req.orgMember.department_id;
    }
    return true; // Available / unallocated assets are visible
  }

  return true; // Admin and Asset Managers can access anything in the org
};

export const listAssets = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { status, category_id, is_shared_resource, search } = req.query;

  try {
    const whereClause = { organization_id: orgId };

    if (status) {
      whereClause.status = status;
    }

    if (category_id) {
      whereClause.category_id = parseInt(category_id, 10);
    }

    if (is_shared_resource !== undefined) {
      whereClause.is_shared_resource = is_shared_resource === 'true' || is_shared_resource === '1';
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { tag: { [Op.like]: `%${search}%` } },
        { serial_number: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    // Role scoping logic
    const isOwner = req.orgMember.isOwner;
    const role = isOwner ? 'Admin' : req.orgMember.role;

    if (role === 'Employee') {
      whereClause.current_holder_id = req.user.id;
    } else if (role === 'Department Head') {
      const deptId = req.orgMember.department_id;
      if (!deptId) {
        // If Dept Head has no department assigned, return empty or limit to unallocated
        whereClause.current_holder_id = null;
      } else {
        const deptMembers = await OrganizationMember.findAll({
          where: { department_id: deptId, organization_id: orgId },
          attributes: ['user_id']
        });
        const userIds = deptMembers.map(m => m.user_id);
        whereClause[Op.or] = [
          { current_holder_id: { [Op.in]: userIds } },
          { current_holder_id: null } // Visible to heads for allocation purposes
        ];
      }
    }

    const assets = await Asset.findAll({
      where: whereClause,
      include: [
        { model: AssetCategory, as: 'Category', attributes: ['id', 'name'] },
        { model: User, as: 'CurrentHolder', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.json(assets);
  } catch (err) {
    console.error('Error fetching assets:', err);
    return res.status(500).json({ error: 'Internal server error fetching assets.' });
  }
};

export const getAsset = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const asset = await Asset.findOne({
      where: { tag, organization_id: orgId },
      include: [
        { model: AssetCategory, as: 'Category', attributes: ['id', 'name'] },
        { model: User, as: 'CurrentHolder', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const hasAccess = await checkAssetAccess(asset, req, orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this asset.' });
    }

    // Retrieve allocation logs
    const allocations = await Allocation.findAll({
      where: { asset_tag: tag, organization_id: orgId },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']]
    });

    // Retrieve maintenance requests
    const maintenance = await MaintenanceRequest.findAll({
      where: { asset_tag: tag, organization_id: orgId },
      include: [{ model: User, as: 'RaisedBy', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']]
    });

    // Retrieve booking reservations
    const bookings = await Booking.findAll({
      where: { asset_tag: tag, organization_id: orgId },
      include: [{ model: User, as: 'BookedBy', attributes: ['id', 'name', 'email'] }],
      order: [['start_time', 'DESC']]
    });

    return res.json({
      ...asset.toJSON(),
      history: {
        allocations,
        maintenance,
        bookings
      }
    });
  } catch (err) {
    console.error('Error fetching asset details:', err);
    return res.status(500).json({ error: 'Internal server error fetching asset details.' });
  }
};

export const registerAsset = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const {
    name,
    category_id,
    is_shared_resource,
    serial_number,
    acquisition_date,
    acquisition_cost,
    condition,
    location,
    photo_url,
    custom_values
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Asset name is required.' });
  }

  try {
    if (category_id) {
      const cat = await AssetCategory.findOne({
        where: { id: category_id, organization_id: orgId }
      });
      if (!cat) {
        return res.status(400).json({ error: 'Category not found in this organization.' });
      }
    }

    // Auto-generate Asset Tag sequentially: e.g., AF-0001
    const count = await Asset.count({ where: { organization_id: orgId } });
    let tagSuffix = count + 1;
    let tag = `AF-${String(tagSuffix).padStart(4, '0')}`;
    let exists = true;

    while (exists) {
      const match = await Asset.findByPk(tag);
      if (!match) {
        exists = false;
      } else {
        tagSuffix++;
        tag = `AF-${String(tagSuffix).padStart(4, '0')}`;
      }
    }

    const asset = await Asset.create({
      tag,
      organization_id: orgId,
      name,
      category_id: category_id || null,
      is_shared_resource: !!is_shared_resource,
      status: 'Available',
      serial_number: serial_number || null,
      acquisition_date: acquisition_date || null,
      acquisition_cost: acquisition_cost || null,
      condition: condition || 'New',
      location: location || null,
      photo_url: photo_url || null,
      custom_values: custom_values || null
    });

    await logActivity(orgId, req.user.id, 'ASSET_REGISTERED', `Registered new asset '${name}' (${tag})`);

    return res.status(201).json({
      message: 'Asset registered successfully.',
      asset
    });
  } catch (err) {
    console.error('Error registering asset:', err);
    return res.status(500).json({ error: 'Internal server error registering asset.' });
  }
};

export const updateAsset = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;
  const {
    name,
    category_id,
    is_shared_resource,
    serial_number,
    acquisition_date,
    acquisition_cost,
    condition,
    location,
    photo_url,
    custom_values
  } = req.body;

  try {
    const asset = await Asset.findOne({
      where: { tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    if (asset.status === 'Disposed') {
      return res.status(409).json({ error: 'Disposed assets are immutable.' });
    }

    if (category_id && category_id !== asset.category_id) {
      // Category is immutable after asset registration to avoid dynamic field schema breakage
      return res.status(409).json({ error: 'Asset category cannot be changed after registration.' });
    }

    if (name !== undefined) asset.name = name;
    if (is_shared_resource !== undefined) asset.is_shared_resource = !!is_shared_resource;
    if (serial_number !== undefined) asset.serial_number = serial_number;
    if (acquisition_date !== undefined) asset.acquisition_date = acquisition_date;
    if (acquisition_cost !== undefined) asset.acquisition_cost = acquisition_cost;
    if (condition !== undefined) asset.condition = condition;
    if (location !== undefined) asset.location = location;
    if (photo_url !== undefined) asset.photo_url = photo_url;
    if (custom_values !== undefined) asset.custom_values = custom_values;

    await asset.save();

    await logActivity(orgId, req.user.id, 'ASSET_UPDATED', `Updated asset '${asset.name}' (${tag}) details`);

    return res.json({ message: 'Asset updated successfully.', asset });
  } catch (err) {
    console.error('Error updating asset:', err);
    return res.status(500).json({ error: 'Internal server error updating asset.' });
  }
};

export const changeAssetStatus = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;
  const { status, reason } = req.body;

  if (!['Available', 'Lost', 'Retired', 'Disposed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status transition.' });
  }

  try {
    const asset = await Asset.findOne({
      where: { tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    if (asset.status === 'Disposed') {
      return res.status(409).json({ error: 'Disposed assets are immutable.' });
    }

    // Pre-condition checking for transitions
    if (status === 'Retired') {
      if (asset.status === 'Allocated') {
        return res.status(409).json({ error: 'Cannot retire asset — it is currently allocated. Process return first.' });
      }
      const openRequests = await MaintenanceRequest.count({
        where: {
          asset_tag: tag,
          organization_id: orgId,
          status: { [Op.in]: ['Pending', 'Approved', 'In Progress'] }
        }
      });
      if (openRequests > 0) {
        return res.status(409).json({ error: 'Cannot retire asset — it has open maintenance requests. Resolve or reject them first.' });
      }
    }

    if (status === 'Disposed' && asset.status !== 'Retired') {
      return res.status(409).json({ error: 'Asset must be Retired before disposal.' });
    }

    const oldStatus = asset.status;
    asset.status = status;
    await asset.save();

    let actionType = 'ASSET_STATUS_CHANGED';
    if (status === 'Lost') actionType = 'ASSET_MARKED_LOST';
    else if (status === 'Retired') actionType = 'ASSET_RETIRED';
    else if (status === 'Disposed') actionType = 'ASSET_DISPOSED';
    else if (status === 'Available' && oldStatus === 'Lost') actionType = 'ASSET_RECOVERED';

    await logActivity(
      orgId,
      req.user.id,
      actionType,
      `Changed status of asset '${asset.name}' (${tag}) from ${oldStatus} to ${status}${reason ? ' — Reason: ' + reason : ''}`
    );

    return res.json({ message: `Asset marked as ${status} successfully.`, asset });
  } catch (err) {
    console.error('Error changing asset status:', err);
    return res.status(500).json({ error: 'Internal server error changing asset status.' });
  }
};

export const exportAssets = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { status, category_id, is_shared_resource, search } = req.query;

  try {
    const whereClause = { organization_id: orgId };
    if (status) whereClause.status = status;
    if (category_id) whereClause.category_id = parseInt(category_id, 10);
    if (is_shared_resource !== undefined) {
      whereClause.is_shared_resource = is_shared_resource === 'true' || is_shared_resource === '1';
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { tag: { [Op.like]: `%${search}%` } },
        { serial_number: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    const assets = await Asset.findAll({
      where: whereClause,
      include: [
        { model: AssetCategory, as: 'Category', attributes: ['name'] },
        { model: User, as: 'CurrentHolder', attributes: ['name'] }
      ]
    });

    let csv = 'Asset Tag,Name,Category,Status,Condition,Location,Current Holder,Acquisition Date,Acquisition Cost,Shared Resource\n';
    assets.forEach(a => {
      const tag = `"${(a.tag || '').replace(/"/g, '""')}"`;
      const name = `"${(a.name || '').replace(/"/g, '""')}"`;
      const category = `"${(a.Category?.name || '').replace(/"/g, '""')}"`;
      const status = `"${(a.status || '').replace(/"/g, '""')}"`;
      const condition = `"${(a.condition || '').replace(/"/g, '""')}"`;
      const location = `"${(a.location || '').replace(/"/g, '""')}"`;
      const holder = `"${(a.CurrentHolder?.name || '').replace(/"/g, '""')}"`;
      const date = a.acquisition_date || '';
      const cost = a.acquisition_cost || '';
      const shared = a.is_shared_resource ? 'Yes' : 'No';

      csv += `${tag},${name},${category},${status},${condition},${location},${holder},${date},${cost},${shared}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=assets-export.csv');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('Error exporting assets:', err);
    return res.status(500).json({ error: 'Internal server error exporting assets.' });
  }
};

export const getAssetAllocations = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const asset = await Asset.findOne({ where: { tag, organization_id: orgId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found.' });

    const hasAccess = await checkAssetAccess(asset, req, orgId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

    const allocations = await Allocation.findAll({
      where: { asset_tag: tag, organization_id: orgId },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json(allocations);
  } catch (err) {
    console.error('Error fetching asset allocations:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getAssetMaintenance = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const asset = await Asset.findOne({ where: { tag, organization_id: orgId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found.' });

    const hasAccess = await checkAssetAccess(asset, req, orgId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

    const maintenance = await MaintenanceRequest.findAll({
      where: { asset_tag: tag, organization_id: orgId },
      include: [{ model: User, as: 'RaisedBy', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json(maintenance);
  } catch (err) {
    console.error('Error fetching asset maintenance requests:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getAssetTimeline = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const asset = await Asset.findOne({ where: { tag, organization_id: orgId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found.' });

    const hasAccess = await checkAssetAccess(asset, req, orgId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

    const logs = await SystemActivityLog.findAll({
      where: {
        organization_id: orgId,
        description: { [Op.like]: `%${tag}%` }
      },
      include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json(logs);
  } catch (err) {
    console.error('Error fetching asset timeline:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
