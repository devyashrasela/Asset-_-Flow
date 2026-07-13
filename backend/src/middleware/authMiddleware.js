import jwt from 'jsonwebtoken';
import { OrganizationMember, Organization } from '../models/index.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required. Please log in.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token. Please log in again.' });
    }
    req.user = user; // user = { id, name, email }
    next();
  });
};

export const requireOrganizationContext = async (req, res, next) => {
  const orgIdHeader = req.headers['x-organization-id'];

  if (!orgIdHeader) {
    return res.status(400).json({ error: 'X-Organization-ID header is required for this request.' });
  }

  const organizationId = parseInt(orgIdHeader, 10);
  if (isNaN(organizationId)) {
    return res.status(400).json({ error: 'Invalid X-Organization-ID header format. Must be an integer.' });
  }

  try {
    // 1. Verify user membership in Organization using Sequelize
    const member = await OrganizationMember.findOne({
      where: {
        organization_id: organizationId,
        user_id: req.user.id
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this workspace.' });
    }

    if (member.status !== 'Active') {
      return res.status(403).json({ error: 'Access denied: Your membership is currently Inactive.' });
    }

    // 2. Fetch Org details to check if user is the Owner (created_by)
    const org = await Organization.findByPk(organizationId);
    const isOwner = org && org.created_by === req.user.id;

    // Attach org context to request
    req.orgMember = {
      organization_id: organizationId,
      role: member.role,
      department_id: member.department_id,
      status: member.status,
      isOwner
    };

    next();
  } catch (err) {
    console.error('Error verifying organization context:', err);
    return res.status(500).json({ error: 'Internal server error while verifying workspace context.' });
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.orgMember) {
      return res.status(400).json({ error: 'Organization context is missing. Action cannot be authorized.' });
    }

    // Org Owner inherits all permissions (treated as Admin equivalent or higher)
    if (req.orgMember.isOwner) {
      return next();
    }

    if (!allowedRoles.includes(req.orgMember.role)) {
      return res.status(403).json({ 
        error: `Access forbidden: This action requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};
