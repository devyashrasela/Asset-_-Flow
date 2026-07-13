import { Op } from 'sequelize';
import { Booking, Asset, AssetCategory, User, OrganizationMember } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

export const listSharedResources = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { search, category_id } = req.query;

  try {
    const whereClause = {
      organization_id: orgId,
      is_shared_resource: true,
      status: { [Op.notIn]: ['Retired', 'Disposed'] }
    };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { tag: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category_id) {
      whereClause.category_id = parseInt(category_id, 10);
    }

    const resources = await Asset.findAll({
      where: whereClause,
      include: [{ model: AssetCategory, as: 'Category', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']]
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Enrich with "next booking" indicator details
    const enrichedResources = await Promise.all(
      resources.map(async (resource) => {
        const nextBooking = await Booking.findOne({
          where: {
            asset_tag: resource.tag,
            organization_id: orgId,
            status: { [Op.in]: ['Upcoming', 'Ongoing'] },
            start_time: { [Op.gte]: todayStart }
          },
          order: [['start_time', 'ASC']],
          include: [{ model: User, as: 'BookedBy', attributes: ['name'] }]
        });

        let nextIndicator = 'Free all day';
        if (nextBooking) {
          const startTime = new Date(nextBooking.start_time);
          const endTime = new Date(nextBooking.end_time);
          
          if (startTime <= now && endTime > now) {
            nextIndicator = `Ongoing until ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isToday = startTime.toDateString() === now.toDateString();
            nextIndicator = `Next: ${timeStr} ${isToday ? 'today' : 'tomorrow'}`;
          }
        }

        return {
          ...resource.toJSON(),
          next_booking_indicator: nextIndicator
        };
      })
    );

    return res.json(enrichedResources);
  } catch (err) {
    console.error('Error fetching shared resources list:', err);
    return res.status(500).json({ error: 'Internal server error listing shared resources.' });
  }
};

export const listBookings = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { asset_tag, date_from, date_to } = req.query;

  if (!asset_tag) {
    return res.status(400).json({ error: 'Asset tag parameter is required.' });
  }

  try {
    const whereClause = {
      organization_id: orgId,
      asset_tag,
      status: { [Op.notIn]: ['Cancelled', 'Rejected', 'Withdrawn'] }
    };

    if (date_from && date_to) {
      whereClause.start_time = { [Op.lt]: new Date(date_to) };
      whereClause.end_time = { [Op.gt]: new Date(date_from) };
    }

    const bookings = await Booking.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'BookedBy', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'ApprovedBy', attributes: ['id', 'name'] }
      ],
      order: [['start_time', 'ASC']]
    });

    return res.json(bookings);
  } catch (err) {
    console.error('Error listing bookings for calendar:', err);
    return res.status(500).json({ error: 'Internal server error fetching calendar slots.' });
  }
};

export const bookResource = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const userRole = req.orgMember.role;
  const userId = req.user.id;
  const { asset_tag, start_time, end_time, booked_for, booked_for_note } = req.body;

  if (!asset_tag || !start_time || !end_time) {
    return res.status(400).json({ error: 'Asset tag, start time, and end time are required.' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Invalid date formats provided.' });
  }

  if (start <= now) {
    return res.status(400).json({ error: 'Start time must be in the future.' });
  }

  if (start >= end) {
    return res.status(400).json({ error: 'End time must be after the start time.' });
  }

  const durationMs = end.getTime() - start.getTime();
  const minDurationMs = 15 * 60 * 1000;
  const maxDurationMs = 8 * 60 * 60 * 1000;

  if (durationMs < minDurationMs) {
    return res.status(400).json({ error: 'Minimum booking duration is 15 minutes.' });
  }

  if (durationMs > maxDurationMs) {
    return res.status(400).json({ error: 'Maximum booking duration is 8 hours.' });
  }

  try {
    // 1. Verify resource exists and is shared
    const asset = await Asset.findOne({
      where: { tag: asset_tag, organization_id: orgId }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found in this organization.' });
    }

    if (!asset.is_shared_resource) {
      return res.status(400).json({ error: 'This asset is not a shared resource.' });
    }

    if (['Lost', 'Retired', 'Disposed'].includes(asset.status)) {
      return res.status(409).json({ error: `Cannot book a resource that is currently: ${asset.status}` });
    }

    if (asset.status === 'Under Maintenance') {
      return res.status(409).json({ error: 'This resource is currently under maintenance. Request blocked.' });
    }

    // 2. Validate Booked For permission details
    let finalBookedFor = req.user.name;
    if (userRole === 'Employee') {
      // Employees can only book for themselves
      finalBookedFor = req.user.name;
    } else if (booked_for) {
      finalBookedFor = booked_for;
    }

    // 3. Create Pending Approval request (no overlap check runs yet)
    const booking = await Booking.create({
      organization_id: orgId,
      asset_tag,
      booked_by_user_id: userId,
      start_time: start,
      end_time: end,
      status: 'Pending Approval',
      booked_for: finalBookedFor,
      booked_for_note: booked_for_note || null
    });

    // Log Activity
    await logActivity(
      orgId,
      userId,
      'BOOKING_REQUESTED',
      `Requested booking for '${asset.name}' (${asset_tag}) from ${start.toLocaleString()} to ${end.toLocaleString()}`
    );

    // Create notifications for Admins & Asset Managers
    const approvers = await OrganizationMember.findAll({
      where: {
        organization_id: orgId,
        role: { [Op.in]: ['Admin', 'Asset Manager'] },
        status: 'Active'
      }
    });

    for (const approver of approvers) {
      await createNotification(
        orgId,
        approver.user_id,
        'New Booking Request',
        `New booking request by ${req.user.name} for "${asset.name}" (${asset_tag}).`
      );
    }

    return res.status(201).json({
      message: 'Booking request created successfully. Awaiting approval.',
      booking
    });
  } catch (err) {
    console.error('Error requesting resource booking:', err);
    return res.status(500).json({ error: 'Internal server error creating booking request.' });
  }
};

export const listPendingApprovals = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { resource, requester_id } = req.query;

  try {
    const whereClause = {
      organization_id: orgId,
      status: 'Pending Approval'
    };

    if (resource) {
      whereClause.asset_tag = resource;
    }

    if (requester_id) {
      whereClause.booked_by_user_id = parseInt(requester_id, 10);
    }

    const requests = await Booking.findAll({
      where: whereClause,
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name'] },
        { model: User, as: 'BookedBy', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'ASC']]
    });

    return res.json(requests);
  } catch (err) {
    console.error('Error fetching approvals queue:', err);
    return res.status(500).json({ error: 'Internal server error fetching approval queue.' });
  }
};

export const approveBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status'] }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking request not found.' });
    }

    // 1. Guard against self-approval
    if (booking.booked_by_user_id === req.user.id) {
      return res.status(400).json({ error: 'Self-approval prevention: You cannot approve your own booking requests.' });
    }

    // 2. Terminal state guard
    if (booking.status !== 'Pending Approval') {
      return res.status(409).json({ error: `Cannot approve. Booking is already in a terminal state: ${booking.status}.` });
    }

    // 3. Resource checks
    const asset = booking.Asset;
    if (!asset || ['Lost', 'Retired', 'Disposed'].includes(asset.status)) {
      return res.status(409).json({ error: `Cannot approve booking. Asset is currently: ${asset ? asset.status : 'Deleted'}.` });
    }
    if (asset.status === 'Under Maintenance') {
      return res.status(409).json({ error: 'Cannot approve booking. Asset is currently under maintenance.' });
    }

    // 4. Overlap validation check
    const start = booking.start_time;
    const end = booking.end_time;

    const conflict = await Booking.findOne({
      where: {
        asset_tag: booking.asset_tag,
        organization_id: orgId,
        status: { [Op.in]: ['Upcoming', 'Ongoing'] },
        start_time: { [Op.lt]: end },
        end_time: { [Op.gt]: start }
      },
      include: [{ model: User, as: 'BookedBy', attributes: ['name'] }]
    });

    if (conflict) {
      const conflictName = conflict.BookedBy ? conflict.BookedBy.name : 'another member';
      return res.status(409).json({
        error: 'Booking conflict found. Cannot approve.',
        message: `Slot overlaps with active booking by ${conflictName} from ${new Date(conflict.start_time).toLocaleTimeString()} to ${new Date(conflict.end_time).toLocaleTimeString()}.`
      });
    }

    // 5. Update Status
    booking.status = 'Upcoming';
    booking.approved_by_user_id = req.user.id;
    booking.approved_at = new Date();
    await booking.save();

    // Log Activity
    const assetName = asset ? asset.name : booking.asset_tag;
    await logActivity(
      orgId,
      req.user.id,
      'BOOKING_APPROVED',
      `Approved booking for '${assetName}' (${booking.asset_tag}) from ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}`
    );

    // Send Notification to Booker
    await createNotification(
      orgId,
      booking.booked_by_user_id,
      'Booking Approved',
      `Your booking for "${assetName}" has been approved!`
    );

    return res.json({ message: 'Booking approved successfully.', booking });
  } catch (err) {
    console.error('Error approving booking:', err);
    return res.status(500).json({ error: 'Internal server error approving booking.' });
  }
};

export const rejectBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['name'] }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking request not found.' });
    }

    // Terminal state guard
    if (booking.status !== 'Pending Approval') {
      return res.status(409).json({ error: `Cannot reject. Booking is already in a terminal state: ${booking.status}.` });
    }

    booking.status = 'Rejected';
    booking.rejected_by_user_id = req.user.id;
    booking.rejection_reason = reason;
    await booking.save();

    const assetName = booking.Asset ? booking.Asset.name : booking.asset_tag;

    // Log Activity
    await logActivity(
      orgId,
      req.user.id,
      'BOOKING_REJECTED',
      `Rejected booking request for '${assetName}' (${booking.asset_tag}) — Reason: ${reason}`
    );

    // Notify Booker
    await createNotification(
      orgId,
      booking.booked_by_user_id,
      'Booking Rejected',
      `Your booking for "${assetName}" was rejected. Reason: ${reason}`
    );

    return res.json({ message: 'Booking request rejected.', booking });
  } catch (err) {
    console.error('Error rejecting booking:', err);
    return res.status(500).json({ error: 'Internal server error rejecting booking.' });
  }
};

export const withdrawBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['name'] }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Withdraw ownership check
    if (booking.booked_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You cannot withdraw another user\'s pending request.' });
    }

    // Terminal state guard
    if (booking.status !== 'Pending Approval') {
      return res.status(409).json({ error: `Cannot withdraw. Booking is already in a terminal state: ${booking.status}.` });
    }

    booking.status = 'Withdrawn';
    await booking.save();

    const assetName = booking.Asset ? booking.Asset.name : booking.asset_tag;

    // Log Activity
    await logActivity(
      orgId,
      req.user.id,
      'BOOKING_WITHDRAWN',
      `Withdrew booking request for '${assetName}' (${booking.asset_tag})`
    );

    return res.json({ message: 'Booking request withdrawn successfully.', booking });
  } catch (err) {
    console.error('Error withdrawing booking request:', err);
    return res.status(500).json({ error: 'Internal server error withdrawing booking request.' });
  }
};

export const getBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [
        { model: Asset, as: 'Asset', attributes: ['tag', 'name', 'status'] },
        { model: User, as: 'BookedBy', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'ApprovedBy', attributes: ['id', 'name'] },
        { model: User, as: 'RejectedBy', attributes: ['id', 'name'] }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking details not found.' });
    }

    const isManager = ['Asset Manager', 'Admin'].includes(req.orgMember.role) || req.orgMember.isOwner;
    if (booking.booked_by_user_id !== req.user.id && !isManager) {
      return res.status(403).json({ error: 'Forbidden: Access denied to view this booking.' });
    }

    return res.json(booking);
  } catch (err) {
    console.error('Error fetching booking details:', err);
    return res.status(500).json({ error: 'Internal server error fetching booking.' });
  }
};

export const rescheduleBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);
  const { start_time, end_time } = req.body;

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'Start time and end time are required.' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);
  const now = new Date();

  if (start <= now) {
    return res.status(400).json({ error: 'Start time must be in the future.' });
  }

  if (start >= end) {
    return res.status(400).json({ error: 'End time must be after the start time.' });
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs < 15 * 60 * 1000) {
    return res.status(400).json({ error: 'Minimum booking duration is 15 minutes.' });
  }
  if (durationMs > 8 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Maximum booking duration is 8 hours.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['name', 'status'] }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking details not found.' });
    }

    // Ownership check
    const isManager = ['Asset Manager', 'Admin'].includes(req.orgMember.role) || req.orgMember.isOwner;
    if (booking.booked_by_user_id !== req.user.id && !isManager) {
      return res.status(403).json({ error: 'Forbidden: You cannot reschedule another user\'s booking.' });
    }

    // Terminal state guard
    if (booking.status !== 'Upcoming') {
      return res.status(409).json({ error: `Cannot reschedule booking in '${booking.status}' status. Reschedule is only allowed for Upcoming bookings.` });
    }

    // Resource check
    const asset = booking.Asset;
    if (asset && asset.status === 'Under Maintenance') {
      return res.status(409).json({ error: 'Cannot reschedule: Shared resource is currently under maintenance.' });
    }

    // Overlap validation check (excluding self)
    const conflict = await Booking.findOne({
      where: {
        asset_tag: booking.asset_tag,
        organization_id: orgId,
        id: { [Op.ne]: bookingId },
        status: { [Op.in]: ['Upcoming', 'Ongoing'] },
        start_time: { [Op.lt]: end },
        end_time: { [Op.gt]: start }
      },
      include: [{ model: User, as: 'BookedBy', attributes: ['name'] }]
    });

    if (conflict) {
      const conflictName = conflict.BookedBy ? conflict.BookedBy.name : 'another member';
      return res.status(409).json({
        error: 'Overlap conflict: Requested reschedule slot is already reserved.',
        message: `This resource is already booked by ${conflictName} from ${new Date(conflict.start_time).toLocaleTimeString()} to ${new Date(conflict.end_time).toLocaleTimeString()}.`
      });
    }

    const oldStart = booking.start_time;
    const oldEnd = booking.end_time;

    booking.start_time = start;
    booking.end_time = end;
    booking.reminder_sent = false; // Reset reminder flag so they receive reminder for new time!
    await booking.save();

    const assetName = asset ? asset.name : booking.asset_tag;

    // Log Activity
    await logActivity(
      orgId,
      req.user.id,
      'BOOKING_RESCHEDULED',
      `Rescheduled booking for '${assetName}' (${booking.asset_tag}) from ${new Date(oldStart).toLocaleString()}–${new Date(oldEnd).toLocaleString()} to ${start.toLocaleString()}–${end.toLocaleString()}`
    );

    // Notify Booker
    await createNotification(
      orgId,
      booking.booked_by_user_id,
      'Booking Rescheduled',
      `Your booking for "${assetName}" has been rescheduled to start at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    );

    return res.json({ message: 'Booking rescheduled successfully.', booking });
  } catch (err) {
    console.error('Error rescheduling booking:', err);
    return res.status(500).json({ error: 'Internal server error rescheduling booking.' });
  }
};

export const cancelBooking = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const bookingId = parseInt(req.params.id, 10);

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID.' });
  }

  try {
    const booking = await Booking.findOne({
      where: { id: bookingId, organization_id: orgId },
      include: [{ model: Asset, as: 'Asset', attributes: ['name'] }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking details not found.' });
    }

    // Ownership check
    const isManager = ['Asset Manager', 'Admin'].includes(req.orgMember.role) || req.orgMember.isOwner;
    if (booking.booked_by_user_id !== req.user.id && !isManager) {
      return res.status(403).json({ error: 'Forbidden: You cannot cancel another user\'s booking.' });
    }

    // Terminal state guard
    if (!['Upcoming', 'Ongoing'].includes(booking.status)) {
      return res.status(409).json({ error: `Cannot cancel booking. Current status is: ${booking.status}.` });
    }

    booking.status = 'Cancelled';
    await booking.save();

    const assetName = booking.Asset ? booking.Asset.name : booking.asset_tag;

    // Log Activity
    await logActivity(
      orgId,
      req.user.id,
      'BOOKING_CANCELLED',
      `Cancelled booking for '${assetName}' (${booking.asset_tag}) scheduled for ${new Date(booking.start_time).toLocaleString()}–${new Date(booking.end_time).toLocaleString()}`
    );

    // Notify Booker
    await createNotification(
      orgId,
      booking.booked_by_user_id,
      'Booking Cancelled',
      `Your booking for "${assetName}" has been cancelled.`
    );

    return res.json({ message: 'Booking cancelled successfully.', booking });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    return res.status(500).json({ error: 'Internal server error cancelling booking.' });
  }
};

export const listMyBookings = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const userId = req.user.id;

  try {
    const bookings = await Booking.findAll({
      where: {
        organization_id: orgId,
        booked_by_user_id: userId
      },
      include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }],
      order: [['start_time', 'DESC']]
    });

    return res.json(bookings);
  } catch (err) {
    console.error('Error listing user bookings:', err);
    return res.status(500).json({ error: 'Internal server error listing bookings.' });
  }
};

export const getAssetBookingHistory = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { tag } = req.params;

  try {
    const bookings = await Booking.findAll({
      where: {
        organization_id: orgId,
        asset_tag: tag
      },
      include: [
        { model: User, as: 'BookedBy', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'ApprovedBy', attributes: ['id', 'name'] }
      ],
      order: [['start_time', 'DESC']]
    });

    return res.json(bookings);
  } catch (err) {
    console.error('Error fetching asset booking history:', err);
    return res.status(500).json({ error: 'Internal server error fetching booking history.' });
  }
};
