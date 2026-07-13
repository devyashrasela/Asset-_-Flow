import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, OrganizationMember, Organization } from '../models/index.js';
import { logActivity } from '../utils/activityLogger.js';

// Password complexity check: Min 8 chars, 1 uppercase, 1 lowercase, 1 digit
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Helper to manually parse cookies (avoids extra cookie-parser dependency)
const getCookie = (req, name) => {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(c => {
      const parts = c.split('=');
      cookies[parts[0].trim()] = parts[1] ? decodeURIComponent(parts[1].trim()) : '';
    });
  }
  return cookies[name];
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long, containing at least 1 uppercase letter, 1 lowercase letter, and 1 digit.' });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      // 409 Conflict per plan
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password_hash: passwordHash
    });

    await logActivity(null, user.id, 'REGISTER', `Global user registration completed for ${email}`);

    return res.status(201).json({
      message: 'User registered successfully.',
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Error in user registration:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Generic message to prevent email enumeration
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Access token (15 mins)
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Refresh token (7 days)
    const refreshToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    await logActivity(null, user.id, 'LOGIN', `Successful login for user ${user.email}`);

    return res.json({
      message: 'Login successful.',
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Error in user login:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

export const refresh = async (req, res) => {
  const refreshToken = getCookie(req, 'refreshToken');

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token is missing.' });
  }

  try {
    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Session has expired. Please log in again.' });
      }

      // Issue new access token (15m)
      const accessToken = jwt.sign(
        { id: decoded.id, name: decoded.name, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.json({ token: accessToken });
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
    return res.status(500).json({ error: 'Internal server error refreshing token.' });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  return res.json({ message: 'Logged out successfully.' });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    
    // Always return 200 to prevent email enumeration
    const successResponse = {
      message: 'If that email address exists in our database, we will send a password reset link.'
    };

    if (!user) {
      return res.json(successResponse);
    }

    // Reset token: 15-min expiry, special purpose claim
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Logging action
    await logActivity(null, user.id, 'FORGOT_PASSWORD_REQUEST', `Requested password reset for ${email}`);

    // Print reset link to stdout for testing
    console.log(`[TESTING] Password reset link for ${email}: http://localhost:5173/reset-password?token=${resetToken}`);

    return res.json(successResponse);
  } catch (err) {
    console.error('Error requesting password reset:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long, containing at least 1 uppercase letter, 1 lowercase letter, and 1 digit.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'reset') {
      return res.status(400).json({ error: 'Invalid token purpose.' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    user.password_hash = passwordHash;
    await user.save();

    await logActivity(null, user.id, 'RESET_PASSWORD', `Password reset completed successfully`);

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const memberships = await OrganizationMember.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Organization, attributes: ['name', 'slug'] }]
    });

    const workspaces = memberships.map(m => ({
      org_id: m.organization_id,
      org_name: m.Organization?.name || 'Unknown Workspace',
      slug: m.Organization?.slug || '',
      role: m.role,
      status: m.status
    }));

    return res.json({
      user,
      workspaces
    });
  } catch (err) {
    console.error('Error in user profile:', err);
    return res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

export const listWorkspaces = async (req, res) => {
  try {
    const memberships = await OrganizationMember.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Organization, attributes: ['name', 'slug'] }]
    });

    const workspaces = memberships.map(m => ({
      org_id: m.organization_id,
      org_name: m.Organization?.name || 'Unknown Workspace',
      slug: m.Organization?.slug || '',
      role: m.role,
      status: m.status
    }));

    return res.json(workspaces);
  } catch (err) {
    console.error('Error listing workspaces:', err);
    return res.status(500).json({ error: 'Internal server error listing workspaces.' });
  }
};

export const selectWorkspace = async (req, res) => {
  const { org_id } = req.body;

  if (!org_id) {
    return res.status(400).json({ error: 'Organization/Workspace ID is required.' });
  }

  try {
    const member = await OrganizationMember.findOne({
      where: { organization_id: org_id, user_id: req.user.id }
    });

    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this workspace.' });
    }

    if (member.status !== 'Active') {
      return res.status(403).json({ error: 'Access denied: Your membership is currently Inactive/Suspended.' });
    }

    return res.json({
      success: true,
      active_org_id: org_id,
      current_role: member.role
    });
  } catch (err) {
    console.error('Error selecting workspace:', err);
    return res.status(500).json({ error: 'Internal server error selecting workspace.' });
  }
};

export const linkSlack = async (req, res) => {
  const { email, slack_user_id } = req.body;
  if (!email || !slack_user_id) {
    return res.status(400).json({ error: 'Email and slack_user_id are required.' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.slack_user_id = slack_user_id;
    await user.save();
    return res.json({ message: 'Slack account linked successfully.', user: { id: user.id, email: user.email, slack_user_id } });
  } catch (err) {
    console.error('Error linking slack:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
