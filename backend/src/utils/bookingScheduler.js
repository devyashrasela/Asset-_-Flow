import { Op } from 'sequelize';
import { Booking, Asset } from '../models/index.js';
import { logActivity } from './activityLogger.js';
import { createNotification } from './notificationHelper.js';

export const startBookingScheduler = () => {
  console.log('Booking auto-transitions scheduler initialized.');
  
  // Run loop immediately on startup, then every 60 seconds
  const runSchedulerJob = async () => {
    const now = new Date();
    
    try {
      // 1. Auto-transition Upcoming -> Ongoing
      const [upcomingUpdatedCount] = await Booking.update(
        { status: 'Ongoing' },
        {
          where: {
            status: 'Upcoming',
            start_time: { [Op.lte]: now },
            end_time: { [Op.gt]: now }
          }
        }
      );
      if (upcomingUpdatedCount > 0) {
        console.log(`[Scheduler] Auto-transitioned ${upcomingUpdatedCount} bookings from Upcoming to Ongoing.`);
      }

      // 2. Auto-transition Ongoing -> Completed
      const [ongoingUpdatedCount] = await Booking.update(
        { status: 'Completed' },
        {
          where: {
            status: 'Ongoing',
            end_time: { [Op.lte]: now }
          }
        }
      );
      if (ongoingUpdatedCount > 0) {
        console.log(`[Scheduler] Auto-completed ${ongoingUpdatedCount} ongoing bookings.`);
      }

      // 3. Issue Reminder Notifications (15 minutes prior to start_time)
      const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      const bookingsToRemind = await Booking.findAll({
        where: {
          status: 'Upcoming',
          reminder_sent: false,
          start_time: {
            [Op.lte]: fifteenMinsFromNow,
            [Op.gt]: now
          }
        },
        include: [{ model: Asset, as: 'Asset', attributes: ['tag', 'name'] }]
      });

      for (const booking of bookingsToRemind) {
        booking.reminder_sent = true;
        await booking.save();

        const assetName = booking.Asset ? booking.Asset.name : booking.asset_tag;
        const timeString = new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Log Activity
        await logActivity(
          booking.organization_id,
          booking.booked_by_user_id,
          'BOOKING_REMINDER',
          `Reminder: Booking for '${assetName}' (${booking.asset_tag}) starts in 15 minutes (${timeString})`
        );

        // Write Notification to Database
        await createNotification(
          booking.organization_id,
          booking.booked_by_user_id,
          'Booking Reminder',
          `Your booking for "${assetName}" starts in 15 minutes (${timeString})`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error running background booking transitions:', err);
    }
  };

  // Run immediately and setup 1 minute interval loop
  runSchedulerJob();
  setInterval(runSchedulerJob, 60 * 1000);
};
