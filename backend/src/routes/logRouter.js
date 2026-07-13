import express from 'express';
import { getActivityLogs, exportActivityLog } from '../controllers/logController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Export route must be before the parameterized routes
router.get(
  '/activity-log/export',
  authenticateToken,
  requireOrganizationContext,
  requireRole(['Admin', 'Asset Manager']),
  exportActivityLog
);

router.get(
  '/activity-log',
  authenticateToken,
  requireOrganizationContext,
  requireRole(['Admin', 'Asset Manager', 'Department Head']),
  getActivityLogs
);

export default router;
