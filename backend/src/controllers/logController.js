import { Op } from 'sequelize';
import { SystemActivityLog, User, OrganizationMember } from '../models/index.js';

const PAGE_SIZE = 50;

/**
 * GET /activity-log
 * Admin/Asset Manager: full org view, all filters
 * Department Head: scoped to own department members only
 * Employee: 403
 */
export const getActivityLogs = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const role = req.orgMember.role;

  if (role === 'Employee') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const { page = 1, action_type, user_id, search, start_date, end_date } = req.query;
    const offset = (Math.max(parseInt(page, 10), 1) - 1) * PAGE_SIZE;

    // Base where clause
    const where = { organization_id: orgId };

    if (action_type) {
      where.action_type = action_type;
    }

    // Only Admin/Asset Manager can filter by arbitrary user_id
    if (user_id && ['Admin', 'Asset Manager'].includes(role)) {
      where.user_id = parseInt(user_id, 10);
    }

    if (search) {
      where.description = { [Op.iLike]: `%${search}%` };
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    // For Dept Head: scope to department members
    let userIdScope = null;
    if (role === 'Department Head') {
      const deptId = req.orgMember.department_id;
      const deptMembers = await OrganizationMember.findAll({
        where: { organization_id: orgId, department_id: deptId },
        attributes: ['user_id']
      });
      userIdScope = deptMembers.map(m => m.user_id);
      where.user_id = { [Op.in]: userIdScope };
    }

    const { count, rows } = await SystemActivityLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'name', 'email']
      }],
      order: [['created_at', 'DESC']],
      limit: PAGE_SIZE,
      offset
    });

    return res.json({
      logs: rows,
      total: count,
      page: Math.max(parseInt(page, 10), 1),
      totalPages: Math.ceil(count / PAGE_SIZE)
    });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    return res.status(500).json({ error: 'Internal server error fetching logs.' });
  }
};

/**
 * GET /activity-log/export
 * Admin/Asset Manager ONLY — CSV export (no pagination)
 */
export const exportActivityLog = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const { action_type, user_id, search, start_date, end_date } = req.query;

    const where = { organization_id: orgId };

    if (action_type) where.action_type = action_type;
    if (user_id) where.user_id = parseInt(user_id, 10);
    if (search) where.description = { [Op.iLike]: `%${search}%` };

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    const logs = await SystemActivityLog.findAll({
      where,
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'name', 'email']
      }],
      order: [['created_at', 'DESC']],
      raw: true,
      nest: true
    });

    // Build CSV
    const header = 'Timestamp,User,Role,Action Type,Description';
    const escCsv = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    // Fetch roles for all users in one query
    const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
    const members = userIds.length
      ? await OrganizationMember.findAll({
          where: { organization_id: orgId, user_id: { [Op.in]: userIds } },
          attributes: ['user_id', 'role'],
          raw: true
        })
      : [];
    const roleMap = Object.fromEntries(members.map(m => [m.user_id, m.role]));

    const rows = logs.map(log => [
      escCsv(log.created_at),
      escCsv(log.User?.name || 'Unknown'),
      escCsv(roleMap[log.user_id] || 'N/A'),
      escCsv(log.action_type),
      escCsv(log.description)
    ].join(','));

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activity_log.csv');
    return res.send(csv);
  } catch (err) {
    console.error('Error exporting activity logs:', err);
    return res.status(500).json({ error: 'Internal server error exporting logs.' });
  }
};
