import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { protect, authorize } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as browse from '../controllers/browseController.js';
import * as match from '../controllers/matchController.js';
import * as claims from '../controllers/claimController.js';
import * as social from '../controllers/socialController.js';
import * as admin from '../controllers/adminController.js';
import { itemController } from '../controllers/itemController.js';

const router = Router();
const staff = authorize('staff', 'admin');
const adminOnly = authorize('admin');
// Brute-force protection for the auth endpoints: 100 attempts per 15 minutes per IP in production.
// Only *failed* logins count towards the login limit. Outside production the limit is relaxed so a live
// demo (or a test run) can never lock itself out.
const authLimit = env.isProd ? 100 : 1000;
const limiter = (extra = {}) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }, ...extra,
});
const authLimiter = limiter();
const loginLimiter = limiter({ skipSuccessfulRequests: true });

// ---- public ----
router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.get('/public/stats', browse.publicStats);
router.get('/public/recent', browse.publicRecent);
router.get('/public/settings', browse.publicSettings);
router.get('/catalog', browse.publicCatalog);
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/forgot-password', authLimiter, auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, auth.resetPassword);

// ---- everything below needs a logged-in user ----
router.use(protect);
router.get('/auth/me', auth.me);
router.put('/auth/profile', ...uploadImage('avatar'), auth.updateProfile);
router.put('/auth/password', auth.changePassword);

router.get('/catalog/all', adminOnly, browse.publicCatalog);
router.get('/dashboard', browse.dashboardSummary);
router.get('/items', browse.browse);
router.get('/search', browse.globalSearch);
router.get('/users/saved', browse.listSaved);
router.post('/users/saved', browse.toggleSaved);

for (const kind of ['lost', 'found']) {
  const c = itemController(kind);
  router.route(`/${kind}`).get(c.list).post(...uploadImage('image'), c.create);
  router.route(`/${kind}/:id`).get(c.getOne).put(...uploadImage('image'), c.update).delete(c.remove);
}

router.get('/matches', match.mine);
router.get('/matches/:lostItemId', match.forLostItem);

router.route('/claims').get(claims.list).post(...uploadImage('evidence'), claims.create);
router.route('/claims/:id').get(claims.getOne).put(claims.update);
router.put('/claims/:id/handover', claims.handover);

router.get('/notifications', social.listNotifications);
router.put('/notifications/read-all', social.markAllRead);
router.put('/notifications/:id/read', social.markRead);
router.route('/messages').get(social.getMessages).post(social.sendMessage);
router.get('/messages/unread', social.unreadMessageCount);
router.post('/abuse', social.reportAbuse);

// ---- staff + admin ----
router.get('/admin/staff', staff, admin.staffOverview);
router.get('/admin/reports', staff, admin.listReports);
router.get('/admin/claims', staff, claims.list);
router.put('/admin/reports/:type/:id/verify', staff, admin.verifyReport);
router.put('/admin/reports/:type/:id/flag', staff, admin.toggleFlag);

// ---- admin only ----
router.get('/admin/dashboard', adminOnly, admin.dashboard);
router.get('/admin/analytics', adminOnly, admin.analytics);
router.get('/admin/users', adminOnly, admin.listUsers);
router.route('/admin/users/:id').get(adminOnly, admin.getUser).put(adminOnly, admin.updateUser).delete(adminOnly, admin.deleteUser);
router.put('/admin/users/:id/block', adminOnly, admin.setUserStatus('blocked'));
router.put('/admin/users/:id/unblock', adminOnly, admin.setUserStatus('active'));
router.put('/admin/reports/:type/:id/status', adminOnly, admin.setReportStatus);
router.get('/admin/audit', adminOnly, admin.listAudit);
router.get('/admin/abuse', adminOnly, admin.listAbuse);
router.put('/admin/abuse/:id', adminOnly, admin.handleAbuse);
router.route('/admin/settings').get(adminOnly, admin.getAppSettings).put(adminOnly, admin.updateAppSettings);
router.get('/admin/system', adminOnly, admin.systemStatus);
router.post('/admin/categories', adminOnly, admin.categories.create);
router.route('/admin/categories/:id').put(adminOnly, admin.categories.update).delete(adminOnly, admin.categories.remove);
router.post('/admin/locations', adminOnly, admin.locations.create);
router.route('/admin/locations/:id').put(adminOnly, admin.locations.update).delete(adminOnly, admin.locations.remove);

export default router;
