import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseDateRange = (query) => {
  const end_date = query.end_date || new Date().toISOString().split('T')[0];
  const start_date = query.start_date || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  })();
  return { start_date, end_date };
};

const validateDateRange = (start_date, end_date) => {
  if (new Date(start_date) > new Date(end_date)) {
    return 'start_date must be before end_date.';
  }
  const diffDays = (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24);
  if (diffDays > 730) {
    return 'Date range cannot exceed 2 years.';
  }
  return null;
};

// ─── GET /api/reports/summary ───────────────────────────────────────────────

export const getReportsSummary = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const [[{ total_assets }]] = await sequelize.query(
      `SELECT COUNT(*) AS total_assets FROM Assets WHERE organization_id = :org_id AND status NOT IN ('Retired', 'Disposed')`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT, nest: true, raw: true }
    ).then(r => [r]);

    const [[{ utilization_rate }]] = await sequelize.query(
      `SELECT ROUND(
        COALESCE((SELECT COUNT(*) FROM Assets WHERE organization_id = :org_id AND status = 'Allocated'), 0) /
        GREATEST((SELECT COUNT(*) FROM Assets WHERE organization_id = :org_id AND status NOT IN ('Retired', 'Disposed')), 1) * 100,
        1
      ) AS utilization_rate`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT, nest: true, raw: true }
    ).then(r => [r]);

    const [[{ active_maintenance }]] = await sequelize.query(
      `SELECT COUNT(*) AS active_maintenance FROM Maintenance_Requests WHERE organization_id = :org_id AND status IN ('Pending', 'Approved', 'In Progress')`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT, nest: true, raw: true }
    ).then(r => [r]);

    const [[{ overdue_allocations }]] = await sequelize.query(
      `SELECT COUNT(*) AS overdue_allocations FROM Allocations WHERE organization_id = :org_id AND status = 'Active' AND expected_return_date IS NOT NULL AND expected_return_date < CURDATE()`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT, nest: true, raw: true }
    ).then(r => [r]);

    return res.json({
      total_assets: total_assets || 0,
      utilization_rate: parseFloat(utilization_rate) || 0,
      active_maintenance: active_maintenance || 0,
      overdue_allocations: overdue_allocations || 0
    });
  } catch (err) {
    console.error('Error fetching reports summary:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/utilization ───────────────────────────────────────────

export const getUtilizationReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { start_date, end_date } = parseDateRange(req.query);
  const err = validateDateRange(start_date, end_date);
  if (err) return res.status(400).json({ error: err });

  try {
    const mostUsed = await sequelize.query(
      `SELECT
        a.tag, a.name, COALESCE(ac.name, 'Uncategorized') AS category_name, a.status, a.is_shared_resource,
        COALESCE(alloc_counts.alloc_count, 0) AS allocation_count,
        COALESCE(booking_counts.booking_count, 0) AS booking_count,
        (COALESCE(alloc_counts.alloc_count, 0) + COALESCE(booking_counts.booking_count, 0)) AS total_activity
      FROM Assets a
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      LEFT JOIN (
        SELECT asset_tag, COUNT(*) AS alloc_count FROM Allocations
        WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date
        GROUP BY asset_tag
      ) alloc_counts ON alloc_counts.asset_tag = a.tag
      LEFT JOIN (
        SELECT asset_tag, COUNT(*) AS booking_count FROM Bookings
        WHERE organization_id = :org_id AND start_time BETWEEN :start_date AND :end_date AND status != 'Cancelled'
        GROUP BY asset_tag
      ) booking_counts ON booking_counts.asset_tag = a.tag
      WHERE a.organization_id = :org_id
      ORDER BY total_activity DESC
      LIMIT 20`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const idle = await sequelize.query(
      `SELECT a.tag, a.name, COALESCE(ac.name, 'Uncategorized') AS category_name, a.status, a.is_shared_resource
      FROM Assets a
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      WHERE a.organization_id = :org_id
        AND a.status NOT IN ('Retired', 'Disposed')
        AND a.tag NOT IN (SELECT asset_tag FROM Allocations WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date)
        AND a.tag NOT IN (SELECT asset_tag FROM Bookings WHERE organization_id = :org_id AND start_time BETWEEN :start_date AND :end_date AND status != 'Cancelled')
      ORDER BY a.name ASC`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const trend = await sequelize.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS allocations_count
      FROM Allocations
      WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    return res.json({ most_used: mostUsed, idle_assets: idle, utilization_trend: trend });
  } catch (err) {
    console.error('Error fetching utilization report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/maintenance ───────────────────────────────────────────

export const getMaintenanceReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { start_date, end_date } = parseDateRange(req.query);
  const err = validateDateRange(start_date, end_date);
  if (err) return res.status(400).json({ error: err });

  try {
    const byAsset = await sequelize.query(
      `SELECT mr.asset_tag, a.name AS asset_name, COALESCE(ac.name, 'Uncategorized') AS category_name,
        COUNT(*) AS total_requests,
        SUM(CASE WHEN mr.status='Resolved' THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN mr.status='Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN mr.priority='Critical' THEN 1 ELSE 0 END) AS critical_count,
        SUM(CASE WHEN mr.priority='High' THEN 1 ELSE 0 END) AS high_count
      FROM Maintenance_Requests mr
      JOIN Assets a ON a.tag = mr.asset_tag
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      WHERE mr.organization_id = :org_id AND mr.created_at BETWEEN :start_date AND :end_date
      GROUP BY mr.asset_tag, a.name, ac.name
      ORDER BY total_requests DESC
      LIMIT 20`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const byCategory = await sequelize.query(
      `SELECT COALESCE(ac.name, 'Uncategorized') AS category_name, COUNT(*) AS total_requests
      FROM Maintenance_Requests mr
      JOIN Assets a ON a.tag = mr.asset_tag
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      WHERE mr.organization_id = :org_id AND mr.created_at BETWEEN :start_date AND :end_date
      GROUP BY ac.name
      ORDER BY total_requests DESC`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const priorityDist = await sequelize.query(
      `SELECT priority, COUNT(*) AS count FROM Maintenance_Requests
      WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date
      GROUP BY priority
      ORDER BY FIELD(priority, 'Critical', 'High', 'Medium', 'Low')`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const statusBreakdown = await sequelize.query(
      `SELECT status, COUNT(*) AS count FROM Maintenance_Requests
      WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date
      GROUP BY status
      ORDER BY FIELD(status, 'Pending', 'Approved', 'In Progress', 'Resolved', 'Rejected')`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    return res.json({ by_asset: byAsset, by_category: byCategory, priority_distribution: priorityDist, status_breakdown: statusBreakdown });
  } catch (err) {
    console.error('Error fetching maintenance report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/lifecycle ─────────────────────────────────────────────

export const getLifecycleReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const dueForMaintenance = await sequelize.query(
      `SELECT a.tag, a.name, COALESCE(ac.name, 'Uncategorized') AS category_name, a.status,
        COUNT(mr.id) AS maintenance_count, MAX(mr.created_at) AS last_request_date
      FROM Assets a
      JOIN Maintenance_Requests mr ON mr.asset_tag = a.tag
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      WHERE mr.organization_id = :org_id AND mr.status = 'Resolved'
        AND mr.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND a.organization_id = :org_id AND a.status NOT IN ('Retired', 'Disposed')
      GROUP BY a.tag, a.name, ac.name, a.status
      HAVING maintenance_count >= 2
      ORDER BY maintenance_count DESC`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT }
    );

    const nearingRetirement = await sequelize.query(
      `SELECT a.tag, a.name, COALESCE(ac.name, 'Uncategorized') AS category_name, a.status,
        a.acquisition_date, a.condition,
        DATEDIFF(CURDATE(), a.acquisition_date) AS age_in_days,
        COALESCE(mc.maint_count, 0) AS lifetime_maintenance_count
      FROM Assets a
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      LEFT JOIN (
        SELECT asset_tag, COUNT(*) AS maint_count FROM Maintenance_Requests WHERE organization_id = :org_id GROUP BY asset_tag
      ) mc ON mc.asset_tag = a.tag
      WHERE a.organization_id = :org_id AND a.status NOT IN ('Retired', 'Disposed')
        AND a.acquisition_date IS NOT NULL
        AND a.acquisition_date < DATE_SUB(CURDATE(), INTERVAL 4 YEAR)
      ORDER BY age_in_days DESC`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT }
    );

    const statusDistribution = await sequelize.query(
      `SELECT status, COUNT(*) AS count FROM Assets
      WHERE organization_id = :org_id
      GROUP BY status
      ORDER BY FIELD(status, 'Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed')`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT }
    );

    return res.json({ due_for_maintenance: dueForMaintenance, nearing_retirement: nearingRetirement, status_distribution: statusDistribution });
  } catch (err) {
    console.error('Error fetching lifecycle report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/departments ───────────────────────────────────────────

export const getDepartmentsReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { start_date, end_date } = parseDateRange(req.query);
  const err = validateDateRange(start_date, end_date);
  if (err) return res.status(400).json({ error: err });

  try {
    const allocationSummary = await sequelize.query(
      `SELECT d.id AS department_id, d.name AS department_name,
        COUNT(DISTINCT al.asset_tag) AS active_allocated_assets,
        COUNT(al.id) AS total_allocation_records,
        SUM(CASE WHEN al.status='Active' THEN 1 ELSE 0 END) AS active_allocations,
        SUM(CASE WHEN al.status='Returned' THEN 1 ELSE 0 END) AS returned_allocations,
        SUM(CASE WHEN al.status='Active' AND al.expected_return_date IS NOT NULL AND al.expected_return_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_count
      FROM Departments d
      LEFT JOIN Organization_Members om ON om.department_id = d.id AND om.organization_id = :org_id AND om.status='Active'
      LEFT JOIN Allocations al ON al.assigned_to_user_id = om.user_id AND al.organization_id = :org_id AND al.created_at BETWEEN :start_date AND :end_date
      WHERE d.organization_id = :org_id AND d.status='Active'
      GROUP BY d.id, d.name
      ORDER BY active_allocated_assets DESC`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const headcountRatio = await sequelize.query(
      `SELECT d.id AS department_id, d.name AS department_name,
        COUNT(DISTINCT om.user_id) AS member_count,
        COUNT(DISTINCT CASE WHEN al.status='Active' THEN al.asset_tag END) AS active_assets,
        CASE
          WHEN COUNT(DISTINCT om.user_id) = 0 THEN 0
          ELSE ROUND(COUNT(DISTINCT CASE WHEN al.status='Active' THEN al.asset_tag END) / COUNT(DISTINCT om.user_id), 2)
        END AS asset_to_member_ratio
      FROM Departments d
      LEFT JOIN Organization_Members om ON om.department_id = d.id AND om.organization_id = :org_id AND om.status='Active'
      LEFT JOIN Allocations al ON al.assigned_to_user_id = om.user_id AND al.organization_id = :org_id
      WHERE d.organization_id = :org_id AND d.status='Active'
      GROUP BY d.id, d.name
      ORDER BY active_assets DESC`,
      { replacements: { org_id: orgId }, type: QueryTypes.SELECT }
    );

    return res.json({ allocation_summary: allocationSummary, headcount_ratio: headcountRatio });
  } catch (err) {
    console.error('Error fetching departments report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/bookings/heatmap ──────────────────────────────────────

export const getBookingsHeatmapReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { start_date, end_date } = parseDateRange(req.query);
  const err = validateDateRange(start_date, end_date);
  if (err) return res.status(400).json({ error: err });

  try {
    const heatmap = await sequelize.query(
      `SELECT DAYNAME(start_time) AS day_of_week, HOUR(start_time) AS hour_of_day, COUNT(*) AS booking_count
      FROM Bookings
      WHERE organization_id = :org_id AND start_time BETWEEN :start_date AND :end_date AND status != 'Cancelled'
      GROUP BY DAYNAME(start_time), HOUR(start_time)
      ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), hour_of_day`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const mostBooked = await sequelize.query(
      `SELECT b.asset_tag, a.name AS asset_name, COALESCE(ac.name, 'Uncategorized') AS category_name,
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN b.status='Completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN b.status='Cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        COALESCE(SUM(TIMESTAMPDIFF(HOUR, b.start_time, b.end_time)), 0) AS total_hours_booked
      FROM Bookings b
      JOIN Assets a ON a.tag = b.asset_tag
      LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
      WHERE b.organization_id = :org_id AND b.start_time BETWEEN :start_date AND :end_date
      GROUP BY b.asset_tag, a.name, ac.name
      ORDER BY total_bookings DESC
      LIMIT 15`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    const cancellationRate = await sequelize.query(
      `SELECT COUNT(*) AS total_bookings,
        SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,
        ROUND(COALESCE(SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1) * 100, 0), 2) AS cancellation_rate_pct
      FROM Bookings
      WHERE organization_id = :org_id AND start_time BETWEEN :start_date AND :end_date`,
      { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
    );

    return res.json({ heatmap, most_booked: mostBooked, cancellation_rate: cancellationRate[0] || { total_bookings: 0, cancelled: 0, cancellation_rate_pct: 0 } });
  } catch (err) {
    console.error('Error fetching bookings heatmap report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── GET /api/reports/export ────────────────────────────────────────────────

export const exportReport = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { type } = req.query;

  try {
    let rows, filename, headers;

    if (type === 'utilization') {
      const { start_date, end_date } = parseDateRange(req.query);
      rows = await sequelize.query(
        `SELECT a.tag AS asset_tag, a.name AS asset_name, COALESCE(ac.name, 'Uncategorized') AS category, a.status, a.is_shared_resource,
          COALESCE(alloc.c, 0) AS allocation_count, COALESCE(book.c, 0) AS booking_count,
          (COALESCE(alloc.c, 0) + COALESCE(book.c, 0)) AS total_activity
        FROM Assets a LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
        LEFT JOIN (SELECT asset_tag, COUNT(*) AS c FROM Allocations WHERE organization_id = :org_id AND created_at BETWEEN :start_date AND :end_date GROUP BY asset_tag) alloc ON alloc.asset_tag = a.tag
        LEFT JOIN (SELECT asset_tag, COUNT(*) AS c FROM Bookings WHERE organization_id = :org_id AND start_time BETWEEN :start_date AND :end_date AND status != 'Cancelled' GROUP BY asset_tag) book ON book.asset_tag = a.tag
        WHERE a.organization_id = :org_id ORDER BY total_activity DESC`,
        { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
      );
      headers = ['Asset Tag', 'Name', 'Category', 'Status', 'Shared', 'Allocation Count', 'Booking Count', 'Total Activity'];
      filename = 'utilization_report.csv';
    } else if (type === 'maintenance') {
      const { start_date, end_date } = parseDateRange(req.query);
      rows = await sequelize.query(
        `SELECT mr.asset_tag, a.name AS asset_name, COALESCE(ac.name, 'Uncategorized') AS category,
          COUNT(*) AS total_requests, SUM(CASE WHEN mr.status='Resolved' THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN mr.status='Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN mr.priority='Critical' THEN 1 ELSE 0 END) AS critical, SUM(CASE WHEN mr.priority='High' THEN 1 ELSE 0 END) AS high
        FROM Maintenance_Requests mr JOIN Assets a ON a.tag = mr.asset_tag LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
        WHERE mr.organization_id = :org_id AND mr.created_at BETWEEN :start_date AND :end_date
        GROUP BY mr.asset_tag, a.name, ac.name ORDER BY total_requests DESC`,
        { replacements: { org_id: orgId, start_date, end_date }, type: QueryTypes.SELECT }
      );
      headers = ['Asset Tag', 'Name', 'Category', 'Total Requests', 'Resolved', 'Pending', 'Critical', 'High'];
      filename = 'maintenance_report.csv';
    } else {
      // Combined operational report (default)
      rows = await sequelize.query(
        `SELECT a.tag AS asset_tag, a.name AS asset_name, COALESCE(ac.name, 'Uncategorized') AS category,
          a.status AS current_status, a.is_shared_resource, COALESCE(u.name, '') AS current_holder,
          COALESCE(al_s.total_alloc, 0) AS lifetime_allocations, COALESCE(al_s.active_alloc, 0) AS active_allocations,
          COALESCE(bk_s.total_book, 0) AS lifetime_bookings,
          COALESCE(mt_s.total_maint, 0) AS lifetime_maintenance, COALESCE(mt_s.resolved, 0) AS resolved_maintenance
        FROM Assets a LEFT JOIN Asset_Categories ac ON ac.id = a.category_id
        LEFT JOIN Users u ON u.id = a.current_holder_id
        LEFT JOIN (SELECT asset_tag, COUNT(*) AS total_alloc, SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active_alloc FROM Allocations WHERE organization_id = :org_id GROUP BY asset_tag) al_s ON al_s.asset_tag = a.tag
        LEFT JOIN (SELECT asset_tag, COUNT(*) AS total_book FROM Bookings WHERE organization_id = :org_id AND status != 'Cancelled' GROUP BY asset_tag) bk_s ON bk_s.asset_tag = a.tag
        LEFT JOIN (SELECT asset_tag, COUNT(*) AS total_maint, SUM(CASE WHEN status='Resolved' THEN 1 ELSE 0 END) AS resolved FROM Maintenance_Requests WHERE organization_id = :org_id GROUP BY asset_tag) mt_s ON mt_s.asset_tag = a.tag
        WHERE a.organization_id = :org_id AND a.status NOT IN ('Retired', 'Disposed')
        ORDER BY a.tag ASC`,
        { replacements: { org_id: orgId }, type: QueryTypes.SELECT }
      );
      headers = ['Asset Tag', 'Name', 'Category', 'Status', 'Shared', 'Current Holder', 'Lifetime Allocations', 'Active Allocations', 'Lifetime Bookings', 'Lifetime Maintenance', 'Resolved Maintenance'];
      filename = 'combined_operational_report.csv';
    }

    // Generate CSV
    const escapeCSV = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csv = headers.join(',') + '\n';
    for (const row of rows) {
      csv += Object.values(row).map(escapeCSV).join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('Error exporting report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
