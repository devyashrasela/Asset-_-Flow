import express from 'express';
import {
  getDashboard,
  getDashboardKPIsOnly,
  getDashboardOverdue,
  getDashboardActivity
} from '../controllers/dashboardController.js';
import { authenticateToken, requireOrganizationContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, requireOrganizationContext, getDashboard);
router.get('/dashboard/kpis', authenticateToken, requireOrganizationContext, getDashboardKPIsOnly);
router.get('/dashboard/overdue', authenticateToken, requireOrganizationContext, getDashboardOverdue);
router.get('/dashboard/activity', authenticateToken, requireOrganizationContext, getDashboardActivity);

export default router;
