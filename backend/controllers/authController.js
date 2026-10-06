import crypto from 'crypto';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { filePath, removeUpload } from '../middleware/upload.js';
import { env } from '../config/env.js';
import { ApiError, asyncHandler, ok, requireFields, isEmail, isStrongPassword, PASSWORD_RULE, pick, text } from '../utils/helpers.js';
import { audit, notifyStaff } from '../services/notify.js';

const RESET_MINUTES = 30;

export const register = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['name', 'studentId', 'email', 'phone', 'password', 'department', 'year']);
  const email = text(b.email).toLowerCase();
  if (!isEmail(email)) throw new ApiError(400, 'Enter a valid email address');
  if (!isStrongPassword(b.password)) throw new ApiError(400, PASSWORD_RULE);
  if (b.confirmPassword !== undefined && b.confirmPassword !== b.password) throw new ApiError(400, 'Passwords do not match');
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  if (await User.exists({ studentId: text(b.studentId).toUpperCase() })) throw new ApiError(409, 'This Student/Staff ID is already registered');

  // Nobody can self-assign privileges: a "staff" sign-up is created as a student and flagged for admin approval.
  const user = await User.create({
    ...pick(b, ['name', 'studentId', 'phone', 'department', 'year', 'password']),
    email,
    role: 'student',
    requestedRole: b.role === 'staff' ? 'staff' : undefined,
  });
  if (user.requestedRole) {
    await notifyStaff('Staff access requested', `${user.name} (${user.studentId}) asked for a staff account.`, 'system', '/admin/users', ['admin']);
  }
  await audit(user, 'REGISTER', user.email);
  ok(res, { token: signToken(user._id), user }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;
  requireFields(req.body, ['email', 'password']);
  const user = await User.findOne({ email: text(email).toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(String(password)))) throw new ApiError(401, 'Invalid email or password');
  if (user.status === 'blocked') throw new ApiError(403, 'Your account has been blocked. Contact the administrator');
  await audit(user, 'LOGIN', user.email);
  ok(res, { token: signToken(user._id, remember === true || remember === 'true'), user });
});

export const me = (req, res) => ok(res, req.user);

// Same answer whether or not the account exists, so the form cannot be used to discover registered emails.
// There is no SMTP server, so nothing is e-mailed: outside production the link is returned for the
// development-only panel in the UI; in production it is neither returned nor logged.
export const forgotPassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['email']);
  const user = await User.findOne({ email: text(req.body.email).toLowerCase() });
  const message = 'If this account exists, a password reset link has been generated.';
  if (!user) return ok(res, { message });
  const token = crypto.randomBytes(24).toString('hex');
  user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
  user.resetExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await user.save();
  const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
  if (!env.isProd) console.log(`[dev] Password reset link for ${user.email}: ${resetUrl}`);
  ok(res, { message, ...(env.isProd ? {} : { resetUrl, devOnly: true, expiresInMinutes: RESET_MINUTES }) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['token', 'password']);
  if (!isStrongPassword(req.body.password)) throw new ApiError(400, PASSWORD_RULE);
  const hashed = crypto.createHash('sha256').update(text(req.body.token)).digest('hex');
  const user = await User.findOne({ resetToken: hashed, resetExpires: { $gt: new Date() } }).select('+resetToken +resetExpires');
  if (!user) throw new ApiError(400, 'Reset link is invalid or has expired');
  user.password = req.body.password;
  user.resetToken = undefined;
  user.resetExpires = undefined;
  await user.save();
  await audit(user, 'PASSWORD_RESET', user.email);
  ok(res, { message: 'Password updated. You can now log in.' });
});

// Only these fields can be changed here. `role`, `status` and `email` are deliberately not on the list.
export const updateProfile = asyncHandler(async (req, res) => {
  const b = req.body;
  const user = req.user;
  Object.assign(user, pick(b, ['name', 'phone', 'department', 'year']));
  if (b.notificationPrefs) {
    let prefs;
    try { prefs = typeof b.notificationPrefs === 'string' ? JSON.parse(b.notificationPrefs) : b.notificationPrefs; } catch { throw new ApiError(400, 'Invalid notification preferences'); }
    for (const k of ['matches', 'claims', 'messages']) if (typeof prefs?.[k] === 'boolean') user.notificationPrefs[k] = prefs[k];
  }
  if (req.file) {
    removeUpload(user.profileImage);
    user.profileImage = filePath(req.file);
  } else if (b.removeAvatar === true || b.removeAvatar === 'true') {
    removeUpload(user.profileImage);
    user.profileImage = undefined;
  }
  await user.save();
  ok(res, user);
});

export const changePassword = asyncHandler(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.checkPassword(String(req.body.currentPassword)))) throw new ApiError(400, 'Current password is incorrect');
  if (!isStrongPassword(req.body.newPassword)) throw new ApiError(400, PASSWORD_RULE);
  user.password = req.body.newPassword;
  await user.save();
  ok(res, { message: 'Password changed' });
});
