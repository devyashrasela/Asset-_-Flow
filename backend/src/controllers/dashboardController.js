import { Op } from 'sequelize';
import { sequelize, AssetCategory, Asset, Booking, TransferRequest, Allocation, SystemActivityLog, User, OrganizationMember, MaintenanceRequest } from '../models/index.js';

// Helper to calculate days overdue
const getDaysOverdue = (expectedDate) => {
  const diffTime = new Date() - new Date(expectedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// GET /api/dashboard
export const getDashboard = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const isOwner = req.orgMember.isOwner;
  const role = isOwner ? 'Admin' : req.orgMember.role;
  const today = new Date();

  try {
    if (role === 'Admin' || role === 'Asset Manager') {
      // 1. Privileged Role Dashboard (Admin/Asset Manager)
      const [
        availableCount,
        allocatedCount,
        maintenanceCount,
        bookingsCount,
        transfersCount,
        upcomingCount,
        categoryDist,
        allocationsTrend
      ] = await Promise.all([
        Asset.count({ where: { organization_id: orgId, status: 'Available' } }),
        Asset.count({ where: { organization_id: orgId, status: 'Allocated' } }),
        Asset.count({ where: { organization_id: orgId, status: 'Under Maintenance' } }),
        Booking.count({ where: { organization_id: orgId, status: { [Op.in]: ['Upcoming', 'Ongoing'] } } }),
        TransferRequest.count({ where: { organization_id: orgId, status: 'Pending' } }),
        Allocation.count({
          where: {
            organization_id: orgId,
            status: 'Active',
            expected_return_date: { [Op.gte]: today }
          }
        }),
        Asset.findAll({
          attributes: [
            'category_id',
            [sequelize.fn('COUNT', sequelize.col('Asset.tag')), 'count']
          ],
          where: { organization_id: orgId },
          group: ['category_id'],
          include: [{ model: AssetCategory, as: 'Category', attributes: ['name'] }]
        }),
        Allocation.findAll({
          attributes: [
            [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          where: {
            organization_id: orgId,
            created_at: { [Op.gte]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000) }
          },
          group: [sequelize.fn('DATE', sequelize.col('created_at'))],
          order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
        })
      ]);

      const overdueAllocations = await Allocation.findAll({
        where: {
          organization_id: orgId,
          status: 'Active',
          expected_return_date: { [Op.lt]: today }
        },
        include: [
          { model: Asset, as: 'Asset', attributes: ['name', 'tag'] },
          { model: User, as: 'User', attributes: ['name'] }
        ]
      });

      const overdue_returns = overdueAllocations.map(a => ({
        allocation_id: a.id,
        asset_tag: a.asset_tag,
        asset_name: a.Asset?.name || 'Unknown Asset',
        holder_name: a.User?.name || 'Unknown User',
        expected_return_date: a.expected_return_date,
        days_overdue: getDaysOverdue(a.expected_return_date)
      }));

      const logs = await SystemActivityLog.findAll({
        where: { organization_id: orgId },
        include: [{ model: User, as: 'User', attributes: ['name'] }],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      const recent_activity = logs.map(l => ({
        id: l.id,
        action_type: l.action_type,
        description: l.description,
        user_name: l.User?.name || 'System',
        created_at: l.created_at
      }));

      const category_distribution = categoryDist.map(c => ({
        name: c.Category?.name || 'Uncategorized',
        count: parseInt(c.getDataValue('count'), 10) || 0
      }));

      const allocations_over_time = allocationsTrend.map(a => ({
        date: a.getDataValue('date'),
        count: parseInt(a.getDataValue('count'), 10) || 0
      }));

      return res.json({
        kpis: {
          assets_available: availableCount,
          assets_allocated: allocatedCount,
          maintenance_today: maintenanceCount,
          active_bookings: bookingsCount,
          pending_transfers: transfersCount,
          upcoming_returns: upcomingCount
        },
        overdue_returns,
        overdue_count: overdue_returns.length,
        recent_activity,
        category_distribution,
        allocations_over_time,
        quick_actions: []
      });
    } else {
      const [
        myAssetsCount,
        maintCount,
        myBookingsCount,
        availableCount
      ] = await Promise.all([
        Asset.count({ where: { organization_id: orgId, current_holder_id: req.user.id } }),
        MaintenanceRequest.count({
          where: {
            organization_id: orgId,
            raised_by_user_id: req.user.id,
            status: { [Op.notIn]: ['Resolved', 'Rejected'] }
          }
        }),
        Booking.count({
          where: {
            organization_id: orgId,
            booked_by_user_id: req.user.id,
            status: { [Op.in]: ['Upcoming', 'Ongoing'] }
          }
        }),
        Asset.count({ where: { organization_id: orgId, status: 'Available' } })
      ]);

      const overdueAllocations = await Allocation.findAll({
        where: {
          organization_id: orgId,
          status: 'Active',
          expected_return_date: { [Op.lt]: today },
          assigned_to_user_id: req.user.id
        },
        include: [
          { model: Asset, as: 'Asset', attributes: ['name', 'tag'] }
        ]
      });

      const overdue_returns = overdueAllocations.map(a => ({
        allocation_id: a.id,
        asset_tag: a.asset_tag,
        asset_name: a.Asset?.name || 'Unknown Asset',
        expected_return_date: a.expected_return_date,
        days_overdue: getDaysOverdue(a.expected_return_date)
      }));

      const logs = await SystemActivityLog.findAll({
        where: {
          organization_id: orgId,
          user_id: req.user.id
        },
        include: [{ model: User, as: 'User', attributes: ['name'] }],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      const recent_activity = logs.map(l => ({
        id: l.id,
        action_type: l.action_type,
        description: l.description,
        user_name: l.User?.name || 'System',
        created_at: l.created_at
      }));

      return res.json({
        kpis: {
          my_assets: myAssetsCount,
          maintenance_today: maintCount,
          my_active_bookings: myBookingsCount,
          assets_available: availableCount
        },
        overdue_returns,
        overdue_count: overdue_returns.length,
        recent_activity,
        quick_actions: []
      });
    }
  } catch (err) {
    console.error('Error compiling dashboard details:', err);
    return res.status(500).json({ error: 'Internal server error compiling dashboard payload.' });
  }
};

// GET /api/dashboard/kpis
export const getDashboardKPIsOnly = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const isOwner = req.orgMember.isOwner;
  const role = isOwner ? 'Admin' : req.orgMember.role;
  const today = new Date();

  try {
    if (role === 'Admin' || role === 'Asset Manager') {
      const [
        availableCount,
        allocatedCount,
        maintenanceCount,
        bookingsCount,
        transfersCount,
        overdueCount,
        upcomingCount
      ] = await Promise.all([
        Asset.count({ where: { organization_id: orgId, status: 'Available' } }),
        Asset.count({ where: { organization_id: orgId, status: 'Allocated' } }),
        Asset.count({ where: { organization_id: orgId, status: 'Under Maintenance' } }),
        Booking.count({ where: { organization_id: orgId, status: { [Op.in]: ['Upcoming', 'Ongoing'] } } }),
        TransferRequest.count({ where: { organization_id: orgId, status: 'Pending' } }),
        Allocation.count({
          where: {
            organization_id: orgId,
            status: 'Active',
            expected_return_date: { [Op.lt]: today }
          }
        }),
        Allocation.count({
          where: {
            organization_id: orgId,
            status: 'Active',
            expected_return_date: { [Op.gte]: today }
          }
        })
      ]);

      return res.json({
        assets_available: availableCount,
        assets_allocated: allocatedCount,
        maintenance_today: maintenanceCount,
        active_bookings: bookingsCount,
        pending_transfers: transfersCount,
        overdue_returns: overdueCount,
        upcoming_returns: upcomingCount
      });
    } else {
      const [
        myAssetsCount,
        maintCount,
        myBookingsCount
      ] = await Promise.all([
        Asset.count({ where: { organization_id: orgId, current_holder_id: req.user.id } }),
        MaintenanceRequest.count({
          where: {
            organization_id: orgId,
            raised_by_user_id: req.user.id,
            status: { [Op.notIn]: ['Resolved', 'Rejected'] }
          }
        }),
        Booking.count({
          where: {
            organization_id: orgId,
            booked_by_user_id: req.user.id,
            status: { [Op.in]: ['Upcoming', 'Ongoing'] }
          }
        })
      ]);

      return res.json({
        my_assets: myAssetsCount,
        maintenance_today: maintCount,
        my_active_bookings: myBookingsCount
      });
    }
  } catch (err) {
    console.error('Error in getDashboardKPIsOnly:', err);
    return res.status(500).json({ error: 'Internal server error fetching dashboard KPIs.' });
  }
};

// GET /api/dashboard/overdue
export const getDashboardOverdue = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const isOwner = req.orgMember.isOwner;
  const role = isOwner ? 'Admin' : req.orgMember.role;
  const today = new Date();

  try {
    const whereClause = {
      organization_id: orgId,
      status: 'Active',
      expected_return_date: { [Op.lt]: today }
    };

    if (role !== 'Admin' && role !== 'Asset Manager') {
      whereClause.assigned_to_user_id = req.user.id;
    }

    const overdueAllocations = await Allocation.findAll({
      where: whereClause,
      include: [
        { model: Asset, as: 'Asset', attributes: ['name', 'tag'] },
        { model: User, as: 'User', attributes: ['name'] }
      ]
    });

    const overdue_returns = overdueAllocations.map(a => ({
      allocation_id: a.id,
      asset_tag: a.asset_tag,
      asset_name: a.Asset?.name || 'Unknown Asset',
      holder_name: role === 'Admin' || role === 'Asset Manager' ? (a.User?.name || 'Unknown User') : undefined,
      expected_return_date: a.expected_return_date,
      days_overdue: getDaysOverdue(a.expected_return_date)
    }));

    return res.json(overdue_returns);
  } catch (err) {
    console.error('Error fetching overdue returns:', err);
    return res.status(500).json({ error: 'Internal server error fetching overdue returns.' });
  }
};

// GET /api/dashboard/activity
export const getDashboardActivity = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const isOwner = req.orgMember.isOwner;
  const role = isOwner ? 'Admin' : req.orgMember.role;

  try {
    const whereClause = { organization_id: orgId };
    if (role !== 'Admin' && role !== 'Asset Manager') {
      whereClause.user_id = req.user.id;
    }

    const logs = await SystemActivityLog.findAll({
      where: whereClause,
      include: [{ model: User, as: 'User', attributes: ['name'] }],
      order: [['created_at', 'DESC']],
      limit: 25
    });

    const recent_activity = logs.map(l => ({
      id: l.id,
      action_type: l.action_type,
      description: l.description,
      user_name: l.User?.name || 'System',
      created_at: l.created_at
    }));

    return res.json(recent_activity);
  } catch (err) {
    console.error('Error fetching recent activity:', err);
    return res.status(500).json({ error: 'Internal server error fetching recent activity.' });
  }
};
