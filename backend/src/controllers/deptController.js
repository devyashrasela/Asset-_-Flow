import { Department, OrganizationMember, User } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../utils/notificationHelper.js';

export const listDepts = async (req, res) => {
  const orgId = req.orgMember.organization_id;

  try {
    const depts = await Department.findAll({
      where: { organization_id: orgId },
      include: [
        { model: Department, as: 'ParentDepartment', attributes: ['id', 'name'] },
        { model: User, as: 'HeadUser', attributes: ['id', 'name', 'email'] }
      ]
    });
    return res.json(depts);
  } catch (err) {
    console.error('Error fetching departments:', err);
    return res.status(500).json({ error: 'Internal server error fetching departments.' });
  }
};

export const createDept = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const { name, parent_id, head_user_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Department name is required.' });
  }

  try {
    if (parent_id) {
      const parent = await Department.findOne({
        where: { id: parent_id, organization_id: orgId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent department not found in this organization.' });
      }
    }

    if (head_user_id) {
      const headMember = await OrganizationMember.findOne({
        where: { user_id: head_user_id, organization_id: orgId, status: 'Active' }
      });
      if (!headMember) {
        return res.status(400).json({ error: 'Assigned department head is not an active member of this organization.' });
      }
    }

    const dept = await Department.create({
      organization_id: orgId,
      name,
      parent_id: parent_id || null,
      head_user_id: head_user_id || null,
      status: 'Active'
    });

    await logActivity(orgId, req.user.id, 'CREATE_DEPT', `Created department: ${name} (ID: ${dept.id})`);

    if (head_user_id) {
      await createNotification(orgId, head_user_id, 'Department Assigned', `You have been appointed as the Head of department: ${name}.`);
      
      const headMember = await OrganizationMember.findOne({
        where: { user_id: head_user_id, organization_id: orgId }
      });
      if (headMember && headMember.role === 'Employee') {
        headMember.role = 'Department Head';
        await headMember.save();
      }
    }

    return res.status(201).json({ message: 'Department created successfully.', department: dept });
  } catch (err) {
    console.error('Error creating department:', err);
    return res.status(500).json({ error: 'Internal server error creating department.' });
  }
};

const wouldCreateCycle = async (deptId, newParentId, orgId) => {
  if (!newParentId) return false;
  if (deptId === newParentId) return true;

  let currentParentId = newParentId;
  while (currentParentId) {
    const parent = await Department.findOne({
      where: { id: currentParentId, organization_id: orgId },
      attributes: ['id', 'parent_id']
    });
    if (!parent) break;
    if (parent.parent_id === deptId) return true;
    currentParentId = parent.parent_id;
  }
  return false;
};

export const updateDept = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const deptId = parseInt(req.params.id, 10);
  const { name, parent_id, head_user_id, status } = req.body;

  if (isNaN(deptId)) {
    return res.status(400).json({ error: 'Invalid department ID parameter.' });
  }

  try {
    const dept = await Department.findOne({
      where: { id: deptId, organization_id: orgId }
    });

    if (!dept) {
      return res.status(404).json({ error: 'Department not found in this organization.' });
    }

    if (parent_id) {
      if (parent_id === deptId) {
        return res.status(400).json({ error: 'A department cannot be its own parent.' });
      }
      
      // Circular hierarchy check
      const circular = await wouldCreateCycle(deptId, parent_id, orgId);
      if (circular) {
        return res.status(409).json({ error: 'Circular hierarchy detected: cannot set parent that creates a loop.' });
      }

      const parent = await Department.findOne({
        where: { id: parent_id, organization_id: orgId }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Parent department not found in this organization.' });
      }
    }

    if (head_user_id) {
      const headMember = await OrganizationMember.findOne({
        where: { user_id: head_user_id, organization_id: orgId, status: 'Active' }
      });
      if (!headMember) {
        return res.status(400).json({ error: 'Assigned department head is not an active member of this organization.' });
      }
    }

    const previousHeadId = dept.head_user_id;

    if (name !== undefined) dept.name = name;
    if (parent_id !== undefined) dept.parent_id = parent_id;
    if (head_user_id !== undefined) dept.head_user_id = head_user_id;
    if (status !== undefined) dept.status = status;

    await dept.save();

    await logActivity(orgId, req.user.id, 'UPDATE_DEPT', `Updated department: ${dept.name} (ID: ${deptId})`);

    // Promote new head
    if (head_user_id && head_user_id !== previousHeadId) {
      await createNotification(orgId, head_user_id, 'Department Head Assigned', `You have been appointed as the Head of department: ${dept.name}.`);
      
      const headMember = await OrganizationMember.findOne({
        where: { user_id: head_user_id, organization_id: orgId }
      });
      if (headMember && headMember.role === 'Employee') {
        headMember.role = 'Department Head';
        await headMember.save();
      }
    }

    // Demote old head if they no longer head any departments in the org
    if (previousHeadId && previousHeadId !== head_user_id) {
      const otherDeptsCount = await Department.count({
        where: { head_user_id: previousHeadId, organization_id: orgId, status: 'Active' }
      });
      if (otherDeptsCount === 0) {
        const oldHeadMember = await OrganizationMember.findOne({
          where: { user_id: previousHeadId, organization_id: orgId }
        });
        if (oldHeadMember && oldHeadMember.role === 'Department Head') {
          oldHeadMember.role = 'Employee';
          await oldHeadMember.save();
        }
      }
    }

    return res.json({ message: 'Department updated successfully.', department: dept });
  } catch (err) {
    console.error('Error updating department:', err);
    return res.status(500).json({ error: 'Internal server error updating department.' });
  }
};

export const deactivateDept = async (req, res) => {
  const orgId = req.orgMember.organization_id;
  const deptId = parseInt(req.params.id, 10);

  if (isNaN(deptId)) {
    return res.status(400).json({ error: 'Invalid department ID parameter.' });
  }

  try {
    const dept = await Department.findOne({
      where: { id: deptId, organization_id: orgId }
    });

    if (!dept) {
      return res.status(404).json({ error: 'Department not found in this organization.' });
    }

    // Check if there are active members assigned to this department
    const activeMembersCount = await OrganizationMember.count({
      where: {
        organization_id: orgId,
        department_id: deptId,
        status: 'Active'
      }
    });

    if (activeMembersCount > 0) {
      return res.status(409).json({ error: 'Cannot deactivate department: active members are still assigned to it.' });
    }

    dept.status = 'Inactive';
    await dept.save();

    await logActivity(orgId, req.user.id, 'DEACTIVATE_DEPT', `Deactivated department: ${dept.name} (ID: ${deptId})`);

    return res.json({ message: 'Department deactivated successfully.', department: dept });
  } catch (err) {
    console.error('Error deactivating department:', err);
    return res.status(500).json({ error: 'Internal server error deactivating department.' });
  }
};

