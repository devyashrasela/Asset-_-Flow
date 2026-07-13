import { Notification } from '../models/index.js';

/**
 * Creates a notification record for a user using Sequelize
 * @param {number} organizationId 
 * @param {number} userId 
 * @param {string} title 
 * @param {string} message 
 */
export const createNotification = async (organizationId, userId, title, message) => {
  try {
    await Notification.create({
      organization_id: organizationId,
      user_id: userId,
      title,
      message
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};
