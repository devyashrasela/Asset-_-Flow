import express from 'express';
import {
  listSharedResources,
  listBookings,
  bookResource,
  listPendingApprovals,
  approveBooking,
  rejectBooking,
  withdrawBooking,
  getBooking,
  rescheduleBooking,
  cancelBooking,
  listMyBookings,
  getAssetBookingHistory
} from '../controllers/bookingController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Order is important to prevent route pattern matching conflict (e.g. static /resources, /approvals, /my before param /:id)
router.get('/bookings/resources', authenticateToken, requireOrganizationContext, listSharedResources);
router.get('/bookings/approvals', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), listPendingApprovals);
router.get('/bookings/my', authenticateToken, requireOrganizationContext, listMyBookings);
router.get('/bookings/asset/:tag/history', authenticateToken, requireOrganizationContext, getAssetBookingHistory);

router.get('/bookings', authenticateToken, requireOrganizationContext, listBookings);
router.post('/bookings', authenticateToken, requireOrganizationContext, bookResource);

router.get('/bookings/:id', authenticateToken, requireOrganizationContext, getBooking);
router.patch('/bookings/:id/approve', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), approveBooking);
router.patch('/bookings/:id/reject', authenticateToken, requireOrganizationContext, requireRole(['Asset Manager', 'Admin']), rejectBooking);
router.patch('/bookings/:id/withdraw', authenticateToken, requireOrganizationContext, withdrawBooking);
router.patch('/bookings/:id/reschedule', authenticateToken, requireOrganizationContext, rescheduleBooking);
router.patch('/bookings/:id/cancel', authenticateToken, requireOrganizationContext, cancelBooking);
router.put('/bookings/:id/cancel', authenticateToken, requireOrganizationContext, cancelBooking); // compatibility fallback

export default router;
