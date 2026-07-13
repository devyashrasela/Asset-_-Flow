import express from 'express';
import {
  listCycles,
  getCycleDetails,
  createCycle,
  activateCycle,
  assignAuditors,
  removeAuditor,
  addItem,
  bulkAddItems,
  removeItem,
  markVerification,
  getDiscrepancies,
  resolveDiscrepancy,
  closeCycle
} from '../controllers/auditController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

const auth = [authenticateToken, requireOrganizationContext];
const adminOnly = [...auth, requireRole(['Admin', 'Asset Manager'])];

// Cycles
router.post('/audit/cycles', ...adminOnly, createCycle);
router.get('/audit/cycles', ...adminOnly, listCycles);
router.get('/audit/cycles/:id', ...auth, getCycleDetails);
router.patch('/audit/cycles/:id/activate', ...adminOnly, activateCycle);

// Auditors
router.post('/audit/cycles/:id/auditors', ...adminOnly, assignAuditors);
router.delete('/audit/cycles/:id/auditors/:userId', ...adminOnly, removeAuditor);

// Items
router.post('/audit/cycles/:id/items', ...auth, addItem);
router.post('/audit/cycles/:id/items/bulk', ...auth, bulkAddItems);
router.delete('/audit/cycles/:id/items/:itemId', ...auth, removeItem);

// Verification
router.patch('/audit/items/:id', ...auth, markVerification);

// Discrepancies
router.get('/audit/cycles/:id/discrepancies', ...auth, getDiscrepancies);
router.patch('/audit/items/:id/resolve', ...adminOnly, resolveDiscrepancy);

// Close
router.post('/audit/cycles/:id/close', ...adminOnly, closeCycle);

export default router;
