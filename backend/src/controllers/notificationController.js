import { Notification } from '../models/index.js';

/**
 * GET /notifications/recent
 * Returns 5 most recent notifications for current user in current org
 */
export const getRecentNotifications = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const notifications = await Notification.findAll({
      where: { organization_id: orgId, user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 5
    });
    return res.json(notifications);
  } catch (err) {
    console.error('Error fetching recent notifications:', err);
    return res.status(500).json({ error: 'Internal server error fetching notifications.' });
  }
};

/**
 * GET /notifications/unread-count
 * Count of unread notifications for current user in current org
 */
export const getUnreadCount = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const count = await Notification.count({
      where: { organization_id: orgId, user_id: req.user.id, is_read: false }
    });
    return res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    return res.status(500).json({ error: 'Internal server error fetching unread count.' });
  }
};

/**
 * PUT /notifications/:id/read
 * Mark single notification as read
 */
export const markAsRead = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const notifId = parseInt(req.params.id, 10);

  if (isNaN(notifId)) {
    return res.status(400).json({ error: 'Invalid notification ID parameter.' });
  }

  try {
    const notification = await Notification.findOne({
      where: { id: notifId, organization_id: orgId, user_id: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found or access denied.' });
    }

    notification.is_read = true;
    await notification.save();

    return res.json({ message: 'Notification marked as read.', notification });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return res.status(500).json({ error: 'Internal server error processing notification.' });
  }
};

/**
 * PUT /notifications/mark-all-read
 * Mark all unread notifications as read for current user in current org
 */
export const markAllAsRead = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const [count] = await Notification.update(
      { is_read: true },
      { where: { organization_id: orgId, user_id: req.user.id, is_read: false } }
    );

    return res.json({ message: 'All notifications marked as read.', count });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return res.status(500).json({ error: 'Internal server error processing notifications.' });
  }
};
