import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
  listWorkspaces,
  selectWorkspace,
  linkSlack
} from '../controllers/authController.js';
import { createOrg } from '../controllers/orgController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', register);
router.post('/register', register); // compatibility path
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, me);
router.post('/link-slack', authenticateToken, linkSlack);

// Workspace endpoints mapped under /auth prefix to match API plan
router.get('/workspaces', authenticateToken, listWorkspaces);
router.post('/workspaces', authenticateToken, createOrg);
router.post('/workspaces/select', authenticateToken, selectWorkspace);

export default router;
