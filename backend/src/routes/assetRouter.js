import express from 'express';
import {
  listAssets,
  getAsset,
  registerAsset,
  updateAsset,
  changeAssetStatus,
  exportAssets,
  getAssetAllocations,
  getAssetMaintenance,
  getAssetTimeline
} from '../controllers/assetController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/assets', authenticateToken, requireOrganizationContext, listAssets);
router.get('/assets/export', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), exportAssets);
router.get('/assets/:tag', authenticateToken, requireOrganizationContext, getAsset);
router.post('/assets', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), registerAsset);
router.put('/assets/:tag', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), updateAsset);
router.patch('/assets/:tag', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), updateAsset);
router.patch('/assets/:tag/status', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), changeAssetStatus);

// History routes
router.get('/assets/:tag/history/allocations', authenticateToken, requireOrganizationContext, getAssetAllocations);
router.get('/assets/:tag/history/maintenance', authenticateToken, requireOrganizationContext, getAssetMaintenance);
router.get('/assets/:tag/history/timeline', authenticateToken, requireOrganizationContext, getAssetTimeline);

export default router;
