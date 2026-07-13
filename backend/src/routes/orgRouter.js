import express from 'express';
import {
  createOrg,
  listOrgs,
  inviteMember,
  listMembers,
  updateMember,
  suspendMember,
  reactivateMember
} from '../controllers/orgController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Base Organization Actions
router.post('/organizations', authenticateToken, createOrg);
router.get('/organizations', authenticateToken, listOrgs);

// Plan-compliant clean context paths (recommended)
router.get('/org/members', authenticateToken, requireOrganizationContext, requireRole(['Admin', 'Asset Manager']), listMembers);
router.post('/org/members/invite', authenticateToken, requireOrganizationContext, requireRole(['Admin']), inviteMember);
router.patch('/org/members/:userId', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateMember);
router.patch('/org/members/:userId/suspend', authenticateToken, requireOrganizationContext, requireRole(['Admin']), suspendMember);
router.patch('/org/members/:userId/reactivate', authenticateToken, requireOrganizationContext, requireRole(['Admin']), reactivateMember);

// Existing compatibility paths
router.post('/organizations/:id/invite', authenticateToken, requireOrganizationContext, requireRole(['Admin']), inviteMember);
router.get('/organizations/:id/members', authenticateToken, requireOrganizationContext, requireRole(['Admin']), listMembers);
router.put('/organizations/:id/members/:userId', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateMember);

export default router;
