import express from 'express';
import {
  getReportsSummary,
  getUtilizationReport,
  getMaintenanceReport,
  getLifecycleReport,
  getDepartmentsReport,
  getBookingsHeatmapReport,
  exportReport
} from '../controllers/reportsController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// All reports are read-only and restricted to Admin + Asset Manager
const reportAuth = [authenticateToken, requireOrganizationContext, requireRole(['Admin', 'Asset Manager'])];

router.get('/reports/summary', ...reportAuth, getReportsSummary);
router.get('/reports/utilization', ...reportAuth, getUtilizationReport);
router.get('/reports/maintenance', ...reportAuth, getMaintenanceReport);
router.get('/reports/lifecycle', ...reportAuth, getLifecycleReport);
router.get('/reports/departments', ...reportAuth, getDepartmentsReport);
router.get('/reports/bookings/heatmap', ...reportAuth, getBookingsHeatmapReport);
router.get('/reports/export', ...reportAuth, exportReport);

export default router;
