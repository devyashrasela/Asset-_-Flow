import { SystemActivityLog } from '../models/index.js';

/**
 * Inserts a log entry into System_Activity_Logs using Sequelize
 * @param {number|null} organizationId 
 * @param {number|null} userId 
 * @param {string} actionType 
 * @param {string} description 
 */
export const logActivity = async (organizationId, userId, actionType, description) => {
  try {
    await SystemActivityLog.create({
      organization_id: organizationId,
      user_id: userId,
      action_type: actionType,
      description
    });
  } catch (err) {
    console.error('Failed to write system activity log:', err);
  }
};
