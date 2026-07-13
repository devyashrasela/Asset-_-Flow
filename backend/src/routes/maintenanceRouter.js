import express from 'express';
import {
  listRequests,
  raiseRequest,
  getRequest,
  approveRequest,
  rejectRequest,
  startWork,
  resolveRequest,
  getAssetMaintenanceHistory
} from '../controllers/maintenanceController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Static routes first to avoid param collision
router.get('/maintenance/asset/:tag', authenticateToken, requireOrganizationContext, getAssetMaintenanceHistory);

router.get('/maintenance', authenticateToken, requireOrganizationContext, listRequests);
router.post('/maintenance', authenticateToken, requireOrganizationContext, raiseRequest);

router.get('/maintenance/:id', authenticateToken, requireOrganizationContext, getRequest);
router.patch('/maintenance/:id/approve', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), approveRequest);
router.patch('/maintenance/:id/reject', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), rejectRequest);
router.patch('/maintenance/:id/start', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), startWork);
router.patch('/maintenance/:id/resolve', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), resolveRequest);

export default router;
