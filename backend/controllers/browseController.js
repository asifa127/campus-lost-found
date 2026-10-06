import User from '../models/User.js';
import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import Claim from '../models/Claim.js';
import { Category, Location, Notification } from '../models/Misc.js';
import { userMatches } from './matchController.js';
import { getSettings } from '../services/settings.js';
import { CLOSED_STATUSES } from '../models/itemFields.js';
import { asyncHandler, ok, pageParams, ApiError, text } from '../utils/helpers.js';
import { MODELS, getModel, itemFilter, shapeItem, REPORTER_FIELDS, activeFilter } from '../services/itemService.js';
import { calculateMatchScore } from '../services/matching.js';

const CARD = 'reportId itemName category brand color location building date status image flagged createdAt userId';

// Best match of each card against the viewer's own opposite-type reports (drives the "possible match" badge).
async function attachMatchScores(items, viewer) {
  const [myLost, myFound] = await Promise.all([
    LostItem.find({ userId: viewer._id, ...activeFilter }).lean(),
    FoundItem.find({ userId: viewer._id, ...activeFilter }).lean(),
  ]);
  for (const it of items) {
    if (String(it.userId) === String(viewer._id)) continue;
    const scores = it.type === 'found'
      ? myLost.map((lost) => calculateMatchScore(lost, it).score)
      : myFound.map((found) => calculateMatchScore(it, found).score);
    const best = Math.max(0, ...scores);
    if (best >= 40) it.matchScore = best;
  }
}

// ponytail: loads matching docs of both collections and sorts/paginates in memory. Fine for a campus-sized dataset;
// switch to a $unionWith aggregation if it grows past a few thousand reports.
export const browse = asyncHandler(async (req, res) => {
  const { type = 'all', sort = 'newest' } = req.query;
  const { page, limit, skip } = pageParams(req.query);
  const scope = (f) => {
    if (type === 'recovered') f.status = 'Recovered';
    else if (!f.status) f.status = { $ne: 'Draft' };
    return f;
  };
  const filter = scope(itemFilter(req.query));
  const kinds = type === 'lost' ? ['lost'] : type === 'found' ? ['found'] : ['lost', 'found'];

  // Category counts for the filter column: every other filter applies, the category filter itself does not.
  const facetFilter = scope(itemFilter({ ...req.query, category: undefined }));
  const [lists, facetRows] = await Promise.all([
    Promise.all(kinds.map(async (k) => (await MODELS[k].find(filter).select(CARD).lean()).map((i) => ({ ...i, type: k })))),
    Promise.all(kinds.map((k) => MODELS[k].aggregate([{ $match: facetFilter }, { $group: { _id: '$category', n: { $sum: 1 } } }]))),
  ]);
  const facets = { category: {} };
  facetRows.flat().forEach((r) => { facets.category[r._id] = (facets.category[r._id] || 0) + r.n; });
  const items = lists.flat();
  await attachMatchScores(items, req.user);

  const q = text(req.query.q).toLowerCase();
  const relevance = (i) => (q && i.itemName.toLowerCase().startsWith(q) ? 2 : q && i.itemName.toLowerCase().includes(q) ? 1 : 0);
  const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const sorters = {
    newest: byNewest,
    oldest: (a, b) => -byNewest(a, b),
    relevant: (a, b) => relevance(b) - relevance(a) || byNewest(a, b),
    match: (a, b) => (b.matchScore || 0) - (a.matchScore || 0) || byNewest(a, b),
  };
  items.sort(sorters[sort] || byNewest);

  ok(res, { items: items.slice(skip, skip + limit), total: items.length, page, pages: Math.ceil(items.length / limit), facets });
});

export const globalSearch = asyncHandler(async (req, res) => {
  const q = text(req.query.q);
  if (q.length < 2) return ok(res, []);
  const filter = { ...itemFilter({ q }), status: { $ne: 'Draft' } };
  const [lost, found] = await Promise.all(
    ['lost', 'found'].map(async (k) => (await MODELS[k].find(filter).sort('-createdAt').limit(6).select(CARD).lean()).map((i) => ({ ...i, type: k })))
  );
  ok(res, [...lost, ...found].slice(0, 10));
});

// Landing-page numbers, all calculated from the database (nothing is hard-coded).
export const publicStats = asyncHandler(async (req, res) => {
  const real = { status: { $ne: 'Draft' } };
  const [lost, found, recovered, activeLost, activeFound, matches, avg] = await Promise.all([
    LostItem.countDocuments(real),
    FoundItem.countDocuments(real),
    FoundItem.countDocuments({ status: 'Recovered' }),
    LostItem.countDocuments({ status: { $nin: CLOSED_STATUSES } }),
    FoundItem.countDocuments({ status: { $nin: CLOSED_STATUSES } }),
    Claim.countDocuments({ status: { $in: ['Approved', 'Completed'] } }),
    Claim.aggregate([{ $match: { matchScore: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$matchScore' } } }]),
  ]);
  ok(res, {
    itemsReported: lost + found,
    itemsRecovered: recovered,
    activeReports: activeLost + activeFound,
    successfulMatches: matches,
    recoveryRate: found ? Math.round((recovered / found) * 100) : 0, // recovered found items / found items reported
    avgMatchConfidence: Math.round(avg[0]?.avg || 0), // average match score of submitted claims
  });
});

// Landing page feed: no reporter info, no login needed.
export const publicRecent = asyncHandler(async (req, res) => {
  const fields = 'reportId itemName category location date status image createdAt';
  const [lost, found] = await Promise.all(
    ['lost', 'found'].map(async (k) => (await MODELS[k].find({ status: { $ne: 'Draft' } }).sort('-createdAt').limit(4).select(fields).lean()).map((i) => ({ ...i, type: k })))
  );
  ok(res, [...lost, ...found].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8));
});

export const publicCatalog = asyncHandler(async (req, res) => {
  const filter = req.originalUrl.includes('/catalog/all') ? {} : { enabled: true };
  const [categories, locations] = await Promise.all([Category.find(filter).sort('name'), Location.find(filter).sort('name')]);
  ok(res, { categories, locations });
});

// Branding shown in the UI (name, institution, contact). Everything else in Settings is admin-only.
export const publicSettings = asyncHandler(async (req, res) => {
  const { appName, institutionName, contactEmail, supportContact } = await getSettings();
  ok(res, { appName, institutionName, contactEmail, supportContact });
});

// ---- saved items ----
export const toggleSaved = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.body;
  const Model = getModel(itemType);
  if (!(await Model.exists({ _id: itemId }))) throw new ApiError(404, 'Item not found');
  const user = await User.findById(req.user._id);
  const idx = user.savedItems.findIndex((s) => String(s.itemId) === String(itemId));
  if (idx >= 0) user.savedItems.splice(idx, 1);
  else user.savedItems.push({ itemType, itemId });
  await user.save();
  ok(res, { saved: idx < 0 });
});

export const listSaved = asyncHandler(async (req, res) => {
  const out = [];
  for (const s of req.user.savedItems) {
    const doc = await MODELS[s.itemType]?.findById(s.itemId).populate('userId', REPORTER_FIELDS);
    if (doc) out.push(shapeItem(doc, s.itemType, req.user));
  }
  ok(res, out);
});

export const dashboardSummary = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const real = { status: { $ne: 'Draft' } };
  const [lost, found, activeClaims, activity, matches] = await Promise.all([
    LostItem.countDocuments({ userId: uid, ...real }),
    FoundItem.countDocuments({ userId: uid, ...real }),
    Claim.countDocuments({ claimant: uid, status: { $in: ['Pending', 'Under Review', 'Approved'] } }),
    Notification.find({ userId: uid }).sort('-createdAt').limit(6),
    userMatches(req.user),
  ]);
  ok(res, { lost, found, activeClaims, matchCount: matches.length, matches: matches.slice(0, 3), activity });
});
