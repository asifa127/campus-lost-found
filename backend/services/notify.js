import User from '../models/User.js';
import { Notification, AuditLog } from '../models/Misc.js';
import { getSettings } from './settings.js';

// notification type -> key in the user's own preferences / the admin's global settings
const PREF_FOR = { match: 'matches', claim: 'claims', handover: 'claims', message: 'messages' };
const GLOBAL_FOR = { match: 'matches', claim: 'claims', handover: 'claims' };

export async function notify(userId, title, message, type = 'system', link = '') {
  // 1. Admin switches (Settings page): a master switch plus claim / match groups.
  const { notifications: global } = await getSettings();
  if (global.enabled === false) return;
  if (GLOBAL_FOR[type] && global[GLOBAL_FOR[type]] === false) return;
  // 2. The recipient's own preferences (Profile page).
  const user = await User.findById(userId).select('notificationPrefs');
  if (!user) return;
  const pref = PREF_FOR[type];
  if (pref && user.notificationPrefs?.[pref] === false) return;
  return Notification.create({ userId, title, message, type, link });
}

export async function notifyStaff(title, message, type = 'system', link = '', roles = ['staff', 'admin']) {
  const staff = await User.find({ role: { $in: roles }, status: 'active' }).select('_id');
  await Promise.all(staff.map((s) => notify(s._id, title, message, type, link)));
}

export const audit = (user, action, target = '', details = '') =>
  AuditLog.create({ user: user?._id || user, action, target, details }).catch((e) => console.error('audit failed', e.message));
