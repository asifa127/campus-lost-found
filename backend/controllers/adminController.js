import mongoose from 'mongoose';
import User from '../models/User.js';
import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import Claim from '../models/Claim.js';
import { Category, Location, AbuseReport, AuditLog, Notification, Message, Setting } from '../models/Misc.js';
import { CLOSED_STATUSES } from '../models/itemFields.js';
import { env } from '../config/env.js';
import { policy } from '../config/policy.js';
import { removeUpload } from '../middleware/upload.js';
import { ApiError, asyncHandler, ok, pageParams, pick, escapeRegex, isEmail, text } from '../utils/helpers.js';
import { MODELS, getModel, itemFilter, shapeItem, deleteItem, REPORTER_FIELDS } from '../services/itemService.js';
import { getSettings, clearSettingsCache } from '../services/settings.js';
import { audit, notify } from '../services/notify.js';

const DAY = 86400000;
const ROLES = ['student', 'staff', 'admin'];
const APPROVED = ['Approved', 'Completed']; // staff decided to hand the item over
const RECOVERED_AT = 'handover.completedAt'; // an item counts as recovered once its handover is completed
const OPEN_CLAIMS = ['Pending', 'Under Review'];
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const ymd = (d) => `${monthKey(d)}-${pad(d.getDate())}`;

// ---------- time ranges (dashboard filter: all time / today / this week / this month) ----------
const RANGES = ['all', 'today', 'week', 'month'];
const rangeOf = (query) => (RANGES.includes(query.range) ? query.range : 'all');

function periodStart(range) {
  const d = new Date();
  if (range === 'today') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (range === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  return null;
}

// The time series switches granularity with the range: months / hours / weekdays / days.
function makeBuckets(range) {
  const now = new Date();
  if (range === 'today') {
    const list = Array.from({ length: now.getHours() + 1 }, (_, h) => ({ key: String(h), label: `${pad(h)}:00` }));
    return { start: periodStart('today'), list, keyOf: (d) => String(new Date(d).getHours()) };
  }
  if (range === 'week') {
    const start = periodStart('week');
    const list = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: ymd(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }) };
    });
    return { start, list, keyOf: (d) => ymd(new Date(d)) };
  }
  if (range === 'month') {
    const start = periodStart('month');
    const list = Array.from({ length: now.getDate() }, (_, i) => ({ key: ymd(new Date(start.getFullYear(), start.getMonth(), i + 1)), label: String(i + 1) }));
    return { start, list, keyOf: (d) => ymd(new Date(d)) };
  }
  const list = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: monthKey(d), label: d.toLocaleString('en-US', { month: 'short' }) };
  });
  return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), list, keyOf: (d) => monthKey(new Date(d)) };
}

// How many were added in the last 30 days.
const addedLast30 = (Model, extra = {}, field = 'createdAt') =>
  Model.countDocuments({ ...extra, [field]: { $gte: new Date(Date.now() - 30 * DAY) } });

const groupCount = (Model, field, match = {}) =>
  Model.aggregate([{ $match: { status: { $ne: 'Draft' }, ...match } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);

// one row per name with separate Lost / Found counts, biggest first
const merge = (lostRows, foundRows) => {
  const m = new Map();
  const row = (name) => m.get(name) || m.set(name, { name, Lost: 0, Found: 0 }).get(name);
  lostRows.forEach((r) => { row(r._id || 'Other').Lost += r.count; });
  foundRows.forEach((r) => { row(r._id || 'Other').Found += r.count; });
  return [...m.values()].sort((a, b) => b.Lost + b.Found - (a.Lost + a.Found));
};

async function buildAnalytics(range = 'all') {
  const since = periodStart(range);
  const { start, list, keyOf } = makeBuckets(range);
  const notDraft = { status: { $ne: 'Draft' } };
  const created = since ? { createdAt: { $gte: since } } : {};

  const [users, lost, found, recovered, pendingClaims, foundAll, recoveredAll, avgScore, lostDocs, foundDocs, recoveredDocs, catL, catF, locL, locF, claimStatus] = await Promise.all([
    User.countDocuments(),
    LostItem.countDocuments({ ...notDraft, ...created }),
    FoundItem.countDocuments({ ...notDraft, ...created }),
    since ? Claim.countDocuments({ status: 'Completed', [RECOVERED_AT]: { $gte: since } }) : FoundItem.countDocuments({ status: 'Recovered' }),
    Claim.countDocuments({ status: { $in: OPEN_CLAIMS } }),
    FoundItem.countDocuments(notDraft),
    FoundItem.countDocuments({ status: 'Recovered' }),
    Claim.aggregate([{ $match: { matchScore: { $gt: 0 }, ...created } }, { $group: { _id: null, avg: { $avg: '$matchScore' } } }]),
    LostItem.find({ ...notDraft, createdAt: { $gte: start } }).select('createdAt').lean(),
    FoundItem.find({ ...notDraft, createdAt: { $gte: start } }).select('createdAt').lean(),
    Claim.find({ status: 'Completed', [RECOVERED_AT]: { $gte: start } }).select(RECOVERED_AT).lean(),
    groupCount(LostItem, 'category', created), groupCount(FoundItem, 'category', created),
    groupCount(LostItem, 'location', created), groupCount(FoundItem, 'location', created),
    Claim.aggregate([{ $match: created }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const perBucket = (docs, when) => {
    const counts = {};
    docs.forEach((d) => { const k = keyOf(when(d)); counts[k] = (counts[k] || 0) + 1; });
    return list.map((b) => counts[b.key] || 0);
  };
  const [lostSeries, foundSeries, recoveredSeries] = [
    perBucket(lostDocs, (d) => d.createdAt), perBucket(foundDocs, (d) => d.createdAt), perBucket(recoveredDocs, (d) => d.handover.completedAt),
  ];

  return {
    range,
    cards: {
      totalUsers: users, lostItems: lost, foundItems: found, recoveredItems: recovered, pendingClaims,
      totalReports: lost + found,
      // recovery rate and the current claim queue are always "now", whatever range is selected
      successRate: foundAll ? Math.round((recoveredAll / foundAll) * 1000) / 10 : 0,
      avgMatchScore: Math.round(avgScore[0]?.avg || 0),
    },
    // shown under the "all time" cards only; the other ranges already are a window
    last30Days: range === 'all' ? {
      users: await addedLast30(User),
      lost: await addedLast30(LostItem, notDraft),
      found: await addedLast30(FoundItem, notDraft),
      recovered: await addedLast30(Claim, { status: 'Completed' }, RECOVERED_AT),
    } : null,
    lostVsFound: list.map((b, i) => ({ label: b.label, Lost: lostSeries[i], Found: foundSeries[i] })),
    recoveryTrend: list.map((b, i) => ({ label: b.label, Recovered: recoveredSeries[i] })),
    categories: merge(catL, catF).slice(0, 9),
    locations: merge(locL, locF).slice(0, 8),
    claimStatus: claimStatus.map((r) => ({ name: r._id, value: r.count })),
  };
}

// Whole-system numbers for the "System overview" panels (not range dependent).
async function buildOverview() {
  const monthStart = periodStart('month');
  const notDraft = { status: { $ne: 'Draft' } };
  const [students, staff, admins, blocked, staffRequests, newThisMonth, lost, found, drafts, flaggedLost, flaggedFound, pendingVerification, recovered, claimRows, resolve, avgScore] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'staff' }), User.countDocuments({ role: 'admin' }),
    User.countDocuments({ status: 'blocked' }), User.countDocuments({ requestedRole: 'staff', role: 'student' }),
    User.countDocuments({ createdAt: { $gte: monthStart } }),
    LostItem.countDocuments(notDraft), FoundItem.countDocuments(notDraft),
    Promise.all([LostItem, FoundItem].map((M) => M.countDocuments({ status: 'Draft' }))).then((a) => a[0] + a[1]),
    LostItem.countDocuments({ flagged: true }), FoundItem.countDocuments({ flagged: true }),
    FoundItem.countDocuments({ status: 'Pending Verification' }),
    FoundItem.countDocuments({ status: 'Recovered' }),
    Claim.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Claim.aggregate([{ $match: { resolvedAt: { $exists: true } } }, { $group: { _id: null, ms: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }]),
    Claim.aggregate([{ $match: { matchScore: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$matchScore' } } }]),
  ]);
  const by = Object.fromEntries(claimRows.map((r) => [r._id, r.n]));
  const decided = (by.Approved || 0) + (by.Completed || 0) + (by.Rejected || 0);
  return {
    users: { total: students + staff + admins, students, staff, admins, blocked, staffRequests, newThisMonth },
    reports: { lost, found, drafts, flagged: flaggedLost + flaggedFound, pendingVerification },
    recovery: {
      recovered, rate: found ? Math.round((recovered / found) * 1000) / 10 : 0,
      avgResolveHours: Math.round(((resolve[0]?.ms || 0) / 3600000) * 10) / 10,
      avgMatchScore: Math.round(avgScore[0]?.avg || 0),
    },
    claims: {
      total: Object.values(by).reduce((a, b) => a + b, 0), pending: by.Pending || 0, underReview: by['Under Review'] || 0,
      approved: by.Approved || 0, completed: by.Completed || 0, rejected: by.Rejected || 0, cancelled: by.Cancelled || 0,
      approvalRate: decided ? Math.round((((by.Approved || 0) + (by.Completed || 0)) / decided) * 100) : 0,
    },
  };
}

const briefItem = (i, type) => ({ _id: i._id, type, reportId: i.reportId, itemName: i.itemName, status: i.status, location: i.location, createdAt: i.createdAt, updatedAt: i.updatedAt });
const briefClaim = (c) => ({
  _id: c._id, claimId: c.claimId, status: c.status, matchScore: c.matchScore, createdAt: c.createdAt,
  itemName: c.foundItem?.itemName, claimant: c.claimant?.name, handoverStatus: c.handover?.status,
});

// Latest actions for the dashboards. Sign-ins stay in the full Audit Logs page but would drown out real activity here.
const recentActivity = () => AuditLog.find({ action: { $ne: 'LOGIN' } }).sort('-createdAt').limit(8).populate('user', 'name role');

// Short work queues shown on the admin and staff dashboards.
async function buildQueues() {
  const [claims, verification, flaggedLost, flaggedFound] = await Promise.all([
    Claim.find({ status: { $in: OPEN_CLAIMS } }).sort('createdAt').limit(5).populate('foundItem', 'itemName').populate('claimant', 'name'),
    FoundItem.find({ status: 'Pending Verification' }).sort('createdAt').limit(5),
    LostItem.find({ flagged: true }).sort('-updatedAt').limit(5),
    FoundItem.find({ flagged: true }).sort('-updatedAt').limit(5),
  ]);
  return {
    attention: {
      pendingClaims: claims.map(briefClaim),
      awaitingVerification: verification.map((i) => briefItem(i, 'found')),
      flagged: [...flaggedLost.map((i) => briefItem(i, 'lost')), ...flaggedFound.map((i) => briefItem(i, 'found'))]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5),
    },
  };
}

export const analytics = asyncHandler(async (req, res) => ok(res, await buildAnalytics(rangeOf(req.query))));

export const dashboard = asyncHandler(async (req, res) => {
  const [data, activity, overview, queues] = await Promise.all([
    buildAnalytics(rangeOf(req.query)),
    recentActivity(),
    buildOverview(),
    buildQueues(),
  ]);
  ok(res, { ...data, activity, overview, ...queues, pendingVerification: overview.reports.pendingVerification, flagged: overview.reports.flagged });
});

// Staff home: what needs doing right now. (Staff and admin.)
export const staffOverview = asyncHandler(async (req, res) => {
  const [pendingVerification, pendingClaims, approvedClaims, handoverPending, claims, verification, activity] = await Promise.all([
    FoundItem.countDocuments({ status: 'Pending Verification' }),
    Claim.countDocuments({ status: { $in: OPEN_CLAIMS } }),
    Claim.countDocuments({ status: { $in: APPROVED } }),
    Claim.countDocuments({ status: 'Approved' }),
    Claim.find({ status: { $in: [...OPEN_CLAIMS, 'Approved'] } }).sort('createdAt').limit(8).populate('foundItem', 'itemName').populate('claimant', 'name'),
    FoundItem.find({ status: 'Pending Verification' }).sort('createdAt').limit(6).populate('userId', 'name'),
    recentActivity(),
  ]);
  const nextAction = (c) => (c.status === 'Pending' ? 'Review claim' : c.status === 'Under Review' ? 'Continue review'
    : c.handover?.status === 'Scheduled' ? 'Complete handover' : 'Schedule handover');
  ok(res, {
    counts: { pendingVerification, pendingClaims, approvedClaims, handoverPending },
    claimsNeedingAttention: claims.map((c) => ({ ...briefClaim(c), nextAction: nextAction(c) })),
    awaitingVerification: verification.map((i) => ({ ...briefItem(i, 'found'), reporter: i.userId?.name })),
    activity,
  });
});

// ---------- users ----------
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 10);
  const f = {};
  if (req.query.role) f.role = text(req.query.role);
  if (req.query.status) f.status = text(req.query.status);
  if (req.query.requested === 'staff') Object.assign(f, { requestedRole: 'staff', role: 'student' }); // pending staff requests
  if (text(req.query.q)) {
    const r = new RegExp(escapeRegex(text(req.query.q)), 'i');
    f.$or = [{ name: r }, { email: r }, { studentId: r }, { department: r }];
  }
  const [items, total] = await Promise.all([User.find(f).sort('-createdAt').skip(skip).limit(limit), User.countDocuments(f)]);
  ok(res, { items, total, page, pages: Math.ceil(total / limit) });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const [lost, found, claims] = await Promise.all([
    LostItem.countDocuments({ userId: user._id }), FoundItem.countDocuments({ userId: user._id }), Claim.countDocuments({ claimant: user._id }),
  ]);
  ok(res, { user, stats: { lost, found, claims } });
});

async function loadTarget(req) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (String(user._id) === String(req.user._id)) throw new ApiError(400, 'You cannot do that to your own account');
  return user;
}

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const b = pick(req.body, ['name', 'phone', 'department', 'year', 'role', 'email']);
  if (b.email !== undefined) {
    b.email = text(b.email).toLowerCase();
    if (!isEmail(b.email)) throw new ApiError(400, 'Enter a valid email address');
  }
  if (b.role !== undefined && !ROLES.includes(b.role)) throw new ApiError(400, 'Invalid role');
  const previousRole = user.role;
  const roleChanged = b.role !== undefined && b.role !== previousRole;
  if (roleChanged && String(user._id) === String(req.user._id)) throw new ApiError(400, 'You cannot change your own role');

  Object.assign(user, b);
  if (roleChanged && b.role === user.requestedRole) user.requestedRole = undefined; // request approved
  const declined = req.body.declineStaffRequest === true && user.requestedRole && !roleChanged;
  if (declined) user.requestedRole = undefined;
  await user.save();

  await audit(req.user, roleChanged ? 'CHANGE_USER_ROLE' : declined ? 'DECLINE_STAFF_REQUEST' : 'UPDATE_USER', user.email,
    roleChanged ? `${previousRole} -> ${user.role}` : JSON.stringify(b));
  if (roleChanged) await notify(user._id, 'Your role was updated', `Your account role is now ${user.role}.`, 'system', '/profile');
  if (declined) await notify(user._id, 'Staff request declined', 'An administrator reviewed your staff request. Your account stays a student account.', 'system', '/profile');
  ok(res, user);
});

export const setUserStatus = (status) => asyncHandler(async (req, res) => {
  const user = await loadTarget(req);
  user.status = status;
  await user.save();
  await audit(req.user, status === 'blocked' ? 'BLOCK_USER' : 'UNBLOCK_USER', user.email);
  ok(res, user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await loadTarget(req);
  const [lostItems, foundItems, claims] = await Promise.all([
    LostItem.find({ userId: user._id }).select('image'), FoundItem.find({ userId: user._id }).select('image'),
    Claim.find({ claimant: user._id }).select('evidence'),
  ]);
  const itemIds = [...lostItems, ...foundItems].map((i) => i._id);
  await Promise.all([
    LostItem.deleteMany({ userId: user._id }), FoundItem.deleteMany({ userId: user._id }),
    Claim.deleteMany({ $or: [{ claimant: user._id }, { foundItem: { $in: foundItems.map((i) => i._id) } }] }),
    Notification.deleteMany({ userId: user._id }), Message.deleteMany({ $or: [{ from: user._id }, { to: user._id }] }),
    AbuseReport.deleteMany({ $or: [{ reporter: user._id }, { itemId: { $in: itemIds } }] }),
  ]);
  [...lostItems.map((i) => i.image), ...foundItems.map((i) => i.image), ...claims.map((c) => c.evidence), user.profileImage].forEach(removeUpload);
  await user.deleteOne();
  await audit(req.user, 'DELETE_USER', user.email);
  ok(res, { message: 'User deleted' });
});

// ---------- reports (lost + found) ----------
export const listReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 10);
  const filter = itemFilter(req.query);
  const type = text(req.query.type) || 'all';
  if (type === 'recovered') filter.status = 'Recovered';
  const kinds = type === 'lost' ? ['lost'] : type === 'found' ? ['found'] : ['lost', 'found'];
  const lists = await Promise.all(
    kinds.map(async (k) => (await MODELS[k].find(filter).sort('-createdAt').populate('userId', REPORTER_FIELDS)).map((d) => shapeItem(d, k, req.user)))
  );
  const all = lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  ok(res, { items: all.slice(skip, skip + limit), total: all.length, page, pages: Math.ceil(all.length / limit) });
});

export const verifyReport = asyncHandler(async (req, res) => {
  const item = await getModel(req.params.type).findById(req.params.id);
  if (!item) throw new ApiError(404, 'Report not found');
  if (CLOSED_STATUSES.includes(item.status)) throw new ApiError(400, 'Only open reports can be verified');
  item.status = item.status === 'Claimed' ? 'Claimed' : 'Verified';
  item.verifiedBy = req.user._id;
  item.verifiedAt = new Date();
  await item.save();
  await notify(item.userId, 'Your report was verified', `${item.itemName} (${item.reportId}) has been verified by campus staff.`, 'report', `/items/${req.params.type}/${item._id}`);
  await audit(req.user, 'VERIFY_REPORT', item.reportId);
  ok(res, item);
});

export const toggleFlag = asyncHandler(async (req, res) => {
  const item = await getModel(req.params.type).findById(req.params.id);
  if (!item) throw new ApiError(404, 'Report not found');
  item.flagged = !item.flagged;
  await item.save();
  await audit(req.user, item.flagged ? 'FLAG_REPORT' : 'UNFLAG_REPORT', item.reportId);
  ok(res, item);
});

export const setReportStatus = asyncHandler(async (req, res) => {
  const Model = getModel(req.params.type);
  const item = await Model.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Report not found');
  const allowed = Model.schema.path('status').enumValues;
  if (!allowed.includes(req.body.status)) throw new ApiError(400, 'Invalid status');
  item.status = req.body.status;
  await item.save();
  await audit(req.user, 'CHANGE_REPORT_STATUS', item.reportId, item.status);
  ok(res, item);
});

// ---------- audit & abuse ----------
export const listAudit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 20);
  const q = text(req.query.q);
  const f = q ? { $or: ['action', 'target', 'details'].map((k) => ({ [k]: new RegExp(escapeRegex(q), 'i') })) } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(f).sort('-createdAt').skip(skip).limit(limit).populate('user', 'name role'), AuditLog.countDocuments(f),
  ]);
  ok(res, { items, total, page, pages: Math.ceil(total / limit) });
});

export const listAbuse = asyncHandler(async (req, res) => {
  const f = req.query.status ? { status: text(req.query.status) } : {};
  ok(res, await AbuseReport.find(f).sort('-createdAt').limit(100).populate('reporter', 'name'));
});

// action: dismiss (keep item) | remove (delete item, keep the abuse reports as a record)
export const handleAbuse = asyncHandler(async (req, res) => {
  const report = await AbuseReport.findById(req.params.id);
  if (!report) throw new ApiError(404, 'Abuse report not found');
  const Model = getModel(report.itemType);
  if (req.body.action === 'remove') {
    const doc = await Model.findById(report.itemId);
    if (doc) await deleteItem(report.itemType, doc, { keepAbuseReports: true });
    await AbuseReport.updateMany({ itemId: report.itemId, status: 'Open' }, { status: 'Resolved', handledBy: req.user._id });
    await audit(req.user, 'REMOVE_REPORTED_ITEM', report.reportId, report.reason);
  } else if (req.body.action === 'dismiss') {
    report.status = 'Dismissed';
    report.handledBy = req.user._id;
    await report.save();
    if (!(await AbuseReport.exists({ itemId: report.itemId, status: 'Open' }))) await Model.updateOne({ _id: report.itemId }, { flagged: false });
    await audit(req.user, 'DISMISS_ABUSE_REPORT', report.reportId);
  } else throw new ApiError(400, 'Unknown action');
  ok(res, { message: 'Abuse report handled' });
});

// ---------- categories & locations (same shape, one factory) ----------
export const catalogCrud = (Model, label, itemModels) => ({
  create: asyncHandler(async (req, res) => {
    const doc = await Model.create({ name: req.body.name, enabled: req.body.enabled !== false });
    await audit(req.user, `CREATE_${label}`, doc.name);
    ok(res, doc, 201);
  }),
  update: asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, `${label} not found`);
    const oldName = doc.name;
    Object.assign(doc, pick(req.body, ['name', 'enabled']));
    await doc.save();
    // keep existing reports pointing at the renamed value
    if (doc.name !== oldName) await Promise.all(itemModels.map((M) => M.updateMany({ [label.toLowerCase()]: oldName }, { [label.toLowerCase()]: doc.name })));
    await audit(req.user, `UPDATE_${label}`, doc.name);
    ok(res, doc);
  }),
  remove: asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, `${label} not found`);
    const used = (await Promise.all(itemModels.map((M) => M.countDocuments({ [label.toLowerCase()]: doc.name })))).reduce((a, b) => a + b, 0);
    if (used) throw new ApiError(400, `${used} report(s) use this ${label.toLowerCase()}. Disable it instead of deleting.`);
    await doc.deleteOne();
    await audit(req.user, `DELETE_${label}`, doc.name);
    ok(res, { message: `${label} deleted` });
  }),
});
export const categories = catalogCrud(Category, 'CATEGORY', [LostItem, FoundItem]);
export const locations = catalogCrud(Location, 'LOCATION', [LostItem, FoundItem]);

// ---------- settings & system status (admin) ----------
export const getAppSettings = asyncHandler(async (req, res) => ok(res, await getSettings()));

const bounded = (value, label, min, max) => {
  const v = text(value);
  if (v.length < min || v.length > max) throw new ApiError(400, min ? `${label} must be ${min}-${max} characters` : `${label} must be at most ${max} characters`);
  return v;
};

export const updateAppSettings = asyncHandler(async (req, res) => {
  const b = req.body;
  const set = {};
  if (b.appName !== undefined) set.appName = bounded(b.appName, 'Application name', 2, 60);
  if (b.institutionName !== undefined) set.institutionName = bounded(b.institutionName, 'Institution name', 2, 80);
  if (b.contactEmail !== undefined) {
    const email = bounded(b.contactEmail, 'Contact email', 0, 120).toLowerCase();
    if (email && !isEmail(email)) throw new ApiError(400, 'Enter a valid contact email address');
    set.contactEmail = email;
  }
  if (b.supportContact !== undefined) set.supportContact = bounded(b.supportContact, 'Support contact', 0, 120);
  for (const k of ['enabled', 'claims', 'matches']) {
    if (b.notifications && b.notifications[k] !== undefined) {
      if (typeof b.notifications[k] !== 'boolean') throw new ApiError(400, `Notification setting "${k}" must be true or false`);
      set[`notifications.${k}`] = b.notifications[k];
    }
  }
  const doc = await Setting.findOneAndUpdate({ key: 'app' }, { $set: set }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true });
  clearSettingsCache();
  await audit(req.user, 'UPDATE_SETTINGS', 'app', Object.keys(set).join(', '));
  ok(res, doc.toObject());
});

export const systemStatus = asyncHandler(async (req, res) => {
  const conn = mongoose.connection;
  let latencyMs = null;
  if (conn.readyState === 1) {
    const t = Date.now();
    await conn.db.admin().ping().then(() => { latencyMs = Date.now() - t; }).catch(() => {});
  }
  ok(res, {
    environment: env.isProd ? 'production' : 'development',
    api: { status: 'online', uptimeSeconds: Math.floor(process.uptime()), nodeVersion: process.version, port: Number(env.port) },
    database: { status: conn.readyState === 1 ? 'connected' : 'disconnected', name: conn.name, latencyMs },
    email: { configured: false },
    storage: { type: 'Local disk', maxUploadMb: policy.upload.maxMb, formats: policy.upload.formats },
    session: policy.session,
    passwordPolicy: { minLength: policy.password.minLength, rule: policy.password.rule, hashing: `bcrypt (cost ${policy.bcryptRounds})` },
  });
});
