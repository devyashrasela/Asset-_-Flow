import express from 'express';
import { getRecentNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../controllers/notificationController.js';
import { authenticateToken, requireOrganizationContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/notifications/recent', authenticateToken, requireOrganizationContext, getRecentNotifications);
router.get('/notifications/unread-count', authenticateToken, requireOrganizationContext, getUnreadCount);

// mark-all-read must come before :id/read to avoid route conflict
router.put('/notifications/mark-all-read', authenticateToken, requireOrganizationContext, markAllAsRead);
router.put('/notifications/:id/read', authenticateToken, requireOrganizationContext, markAsRead);

export default router;
