import express from 'express';
import {
  listAllocations,
  myAllocations,
  listOverdue,
  getAllocationDetail,
  getAssetAllocationHistory,
  allocateAsset,
  returnAsset,
  requestTransfer,
  listTransfers,
  approveTransfer,
  rejectTransfer
} from '../controllers/allocationController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Named routes FIRST (before parameterized :id) ──────────────────────────
router.get('/allocations/my', authenticateToken, requireOrganizationContext, myAllocations);
router.get('/allocations/overdue', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), listOverdue);
router.get('/allocations/asset/:tag/history', authenticateToken, requireOrganizationContext, getAssetAllocationHistory);

// Transfer routes (named — must come before /:id)
router.post('/allocations/transfers', authenticateToken, requireOrganizationContext, requestTransfer);
router.get('/allocations/transfers', authenticateToken, requireOrganizationContext, listTransfers);
router.patch('/allocations/transfers/:id/approve', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), approveTransfer);
router.patch('/allocations/transfers/:id/reject', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), rejectTransfer);

// ── Collection routes ──────────────────────────────────────────────────────
router.get('/allocations', authenticateToken, requireOrganizationContext, listAllocations);
router.post('/allocations', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), allocateAsset);

// ── Parameterized routes LAST ──────────────────────────────────────────────
router.get('/allocations/:id', authenticateToken, requireOrganizationContext, getAllocationDetail);
router.patch('/allocations/:id/return', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), returnAsset);

export default router;
