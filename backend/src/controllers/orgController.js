import { db, sequelize, Organization, OrganizationMember, User, Department } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

export const createOrg = async (req, res) => {
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Organization name and slug are required.' });
  }

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens.' });
  }

  const transaction = await sequelize.transaction();
  try {
    const existing = await Organization.findOne({ where: { slug }, transaction });
    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ error: 'An organization with this slug already exists.' });
    }

    const org = await Organization.create({
      name,
      slug,
      created_by: req.user.id
    }, { transaction });

    await OrganizationMember.create({
      organization_id: org.id,
      user_id: req.user.id,
      role: 'Admin',
      status: 'Active'
    }, { transaction });

    await transaction.commit();

    await logActivity(org.id, req.user.id, 'CREATE_ORG', `Created organization: ${name} (slug: ${slug})`);
    await createNotification(org.id, req.user.id, 'Workspace Created', `Successfully created workspace ${name}. You are the Admin.`);

    return res.status(201).json({
      message: 'Organization created successfully.',
      organization: org
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in createOrg controller:', err);
    return res.status(500).json({ error: 'Internal server error creating organization.' });
  }
};

export const listOrgs = async (req, res) => {
  try {
    const orgs = await Organization.findAll({
      include: [{
        model: OrganizationMember,
        where: { user_id: req.user.id },
        attributes: ['role', 'status']
      }],
      order: [['created_at', 'DESC']]
    });
    return res.json(orgs);
  } catch (err) {
    console.error('Error listing organizations:', err);
    return res.status(500).json({ error: 'Internal server error listing organizations.' });
  }
};

export const inviteMember = async (req, res) => {
  const { email } = req.body;
  const orgId = req.orgMember.organization_id;

  if (!email) {
    return res.status(400).json({ error: 'Invite email address is required.' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No user registered with this email address. They must sign up first.' });
    }

    const existing = await OrganizationMember.findOne({
      where: {
        organization_id: orgId,
        user_id: user.id
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a member of this organization.' });
    }

    const member = await OrganizationMember.create({
      organization_id: orgId,
      user_id: user.id,
      role: 'Employee',
      status: 'Active'
    });

    await logActivity(orgId, req.user.id, 'INVITE_USER', `Invited user ${email} to workspace`);
    await createNotification(orgId, user.id, 'Workspace Invitation', 'You have been added to organization as Employee.');

    return res.status(201).json({
      message: 'User invited and added successfully.',
      member
    });
  } catch (err) {
    console.error('Error inviting user:', err);
    return res.status(500).json({ error: 'Internal server error inviting user.' });
  }
};

export const listMembers = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const members = await OrganizationMember.findAll({
      where: { organization_id: orgId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        },
        {
          model: Department,
          attributes: ['id', 'name']
        }
      ]
    });
    return res.json(members);
  } catch (err) {
    console.error('Error listing members:', err);
    return res.status(500).json({ error: 'Internal server error listing members.' });
  }
};

export const updateMember = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const targetUserId = parseInt(req.params.userId, 10);
  const { role, status, department_id } = req.body;

  if (isNaN(targetUserId)) {
    return res.status(400).json({ error: 'Invalid user ID parameter.' });
  }

  try {
    const member = await OrganizationMember.findOne({
      where: { organization_id: orgId, user_id: targetUserId }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found in this organization.' });
    }

    // 1. Self-demotion/deactivation block (Prevents Admin/Owner lockout)
    if (targetUserId === req.user.id) {
      if (role !== undefined && role !== member.role) {
        return res.status(409).json({ error: 'You cannot change your own role.' });
      }
      if (status !== undefined && status !== member.status) {
        return res.status(409).json({ error: 'You cannot change your own status.' });
      }
    }

    // 2. Demotion Guard: Department Head -> Employee
    if (role === 'Employee' && member.role === 'Department Head') {
      const headOfDept = await Department.findOne({
        where: { head_user_id: targetUserId, organization_id: orgId, status: 'Active' }
      });
      if (headOfDept) {
        return res.status(409).json({ error: `Cannot demote: user is still Department Head of ${headOfDept.name}. Remove them as head first.` });
      }
    }

    // 3. Last Admin Guard: Cannot demote or deactivate the last Active Admin
    if ((role !== undefined && role !== 'Admin' && member.role === 'Admin') || 
        (status === 'Inactive' && member.status === 'Active' && member.role === 'Admin')) {
      const activeAdminsCount = await OrganizationMember.count({
        where: {
          organization_id: orgId,
          role: 'Admin',
          status: 'Active'
        }
      });
      if (activeAdminsCount <= 1) {
        return res.status(409).json({ error: 'Cannot demote or suspend the last active Admin in this organization.' });
      }
    }

    if (department_id !== undefined && department_id !== null) {
      const dept = await Department.findOne({
        where: { id: department_id, organization_id: orgId }
      });
      if (!dept) {
        return res.status(400).json({ error: 'Selected department does not exist in this organization.' });
      }
    }

    const oldRole = member.role;
    const oldStatus = member.status;

    if (role !== undefined) member.role = role;
    if (status !== undefined) member.status = status;
    if (department_id !== undefined) member.department_id = department_id;

    await member.save();

    // Log corresponding activity types
    let actionType = 'UPDATE_MEMBER';
    let activityDesc = `Updated member (ID: ${targetUserId}) profile details`;
    if (role !== undefined && role !== oldRole) {
      actionType = 'ROLE_UPDATED';
      activityDesc = `Updated member role from ${oldRole} to ${role}`;
    } else if (status === 'Inactive' && oldStatus === 'Active') {
      actionType = 'USER_SUSPENDED';
      activityDesc = `Suspended member (ID: ${targetUserId}) from the workspace`;
    } else if (status === 'Active' && oldStatus === 'Inactive') {
      actionType = 'USER_REACTIVATED';
      activityDesc = `Reactivated member (ID: ${targetUserId}) in the workspace`;
    }

    await logActivity(orgId, req.user.id, actionType, activityDesc);
    await createNotification(orgId, targetUserId, 'Profile Updated', 'Your workspace profile role or department has been updated.');

    return res.json({ message: 'Member updated successfully.', member });
  } catch (err) {
    console.error('Error updating member details:', err);
    return res.status(500).json({ error: 'Internal server error updating member.' });
  }
};

export const suspendMember = async (req, res) => {
  req.body = { status: 'Inactive' };
  return updateMember(req, res);
};

export const reactivateMember = async (req, res) => {
  req.body = { status: 'Active' };
  return updateMember(req, res);
};

