import express from 'express';
import { listDepts, createDept, updateDept, deactivateDept } from '../controllers/deptController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Plan-compliant paths
router.get('/org/departments', authenticateToken, requireOrganizationContext, listDepts);
router.post('/org/departments', authenticateToken, requireOrganizationContext, requireRole(['Admin']), createDept);
router.patch('/org/departments/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateDept);
router.patch('/org/departments/:id/deactivate', authenticateToken, requireOrganizationContext, requireRole(['Admin']), deactivateDept);

// Existing compatibility paths
router.get('/departments', authenticateToken, requireOrganizationContext, listDepts);
router.post('/departments', authenticateToken, requireOrganizationContext, requireRole(['Admin']), createDept);
router.put('/departments/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateDept);
router.patch('/departments/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateDept);

export default router;
