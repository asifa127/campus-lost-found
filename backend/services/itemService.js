import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import Claim from '../models/Claim.js';
import User from '../models/User.js';
import { AbuseReport } from '../models/Misc.js';
import { CLOSED_STATUSES } from '../models/itemFields.js';
import { escapeRegex, ApiError, text } from '../utils/helpers.js';
import { removeUpload } from '../middleware/upload.js';
import { rankMatches, calculateMatchScore } from './matching.js';
import { notify } from './notify.js';

export const MODELS = { lost: LostItem, found: FoundItem };
export const getModel = (kind) => {
  if (!MODELS[kind]) throw new ApiError(400, 'Item type must be "lost" or "found"');
  return MODELS[kind];
};

const SEARCH_FIELDS = ['itemName', 'reportId', 'category', 'location', 'building', 'brand', 'color', 'description'];

const list = (v) => text(v).split(',').map((s) => s.trim()).filter(Boolean);

// Mongo filter shared by browse, per-type lists, admin reports and global search.
// `category` and `color` accept comma-separated lists (multi-select filters).
export function itemFilter(q = {}) {
  const f = {};
  for (const k of ['location', 'building', 'status']) if (q[k]) f[k] = text(q[k]);
  if (q.category) f.category = { $in: list(q.category) };
  if (q.color) f.color = { $in: list(q.color).map((c) => new RegExp(escapeRegex(c), 'i')) };
  if (q.dateFrom || q.dateTo) {
    f.date = {};
    if (q.dateFrom) f.date.$gte = new Date(text(q.dateFrom));
    if (q.dateTo) f.date.$lte = new Date(text(q.dateTo));
  }
  if (q.flagged === 'true') f.flagged = true;
  if (text(q.q)) {
    const r = new RegExp(escapeRegex(text(q.q)), 'i');
    f.$or = SEARCH_FIELDS.map((k) => ({ [k]: r }));
  }
  return f;
}

export const REPORTER_FIELDS = 'name department role';

// Both models store the event moment in `date` / `time`. The API also speaks the clearer names:
// lostDate / lostTime on lost reports, foundDate / foundTime on found reports (read and write).
export function withDateAliases(body, kind) {
  const b = { ...body };
  if (b[`${kind}Date`] !== undefined && b.date === undefined) b.date = b[`${kind}Date`];
  if (b[`${kind}Time`] !== undefined && b.time === undefined) b.time = b[`${kind}Time`];
  return b;
}

// Public-safe shape: the reporter exposes name/department only. Private details (identifying features, the
// value, where a found item is kept, who found it) are for the reporter and staff only: they are what staff
// use to check that a claimant really owns the item.
export function shapeItem(doc, kind, viewer) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const reporter = o.userId && o.userId._id ? o.userId : null;
  const ownerId = String(reporter?._id || o.userId);
  const isOwner = !!viewer && ownerId === String(viewer._id);
  const privileged = viewer && ['staff', 'admin'].includes(viewer.role);
  if (!isOwner && !privileged) {
    delete o.uniqueFeatures;
    delete o.estimatedValue;
    delete o.currentLocation;
    delete o.foundBy;
  }
  return {
    ...o,
    type: kind,
    [`${kind}Date`]: o.date,
    [`${kind}Time`]: o.time,
    userId: ownerId,
    reporter: reporter ? { _id: reporter._id, name: reporter.name, department: reporter.department, role: reporter.role } : null,
    isOwner,
  };
}

// Active found items (for lost reports) or active lost items (for found reports).
export const activeFilter = { status: { $nin: CLOSED_STATUSES } };

export async function topMatchesForLost(lost, limit = 5) {
  const found = await FoundItem.find({ ...activeFilter, userId: { $ne: lost.userId } }).lean();
  return rankMatches(lost, found).slice(0, limit);
}

// Called after a new report is submitted. Notifies owners about matches of 60% or more.
export async function runMatchingOnCreate(kind, item) {
  if (kind === 'lost') {
    const matches = await topMatchesForLost(item);
    const good = matches.filter((m) => m.score >= 60);
    if (good.length) {
      await LostItem.updateOne({ _id: item._id, status: 'Submitted' }, { status: 'Matched' });
      await notify(
        item.userId, 'Possible match found',
        `Possible match found for your lost ${item.itemName.toLowerCase()} (${good[0].score}% - ${good[0].found.itemName}).`,
        'match', `/items/found/${good[0].found._id}`
      );
    }
    return matches;
  }
  const lostList = await LostItem.find({ ...activeFilter, userId: { $ne: item.userId } }).lean();
  // Score from each lost report's point of view, keep 60%+ only.
  const found = item.toObject();
  const scored = lostList.map((lost) => ({ lost, ...calculateMatchScore(lost, found) })).filter((m) => m.score >= 60);
  await Promise.all(
    scored.map(async (m) => {
      await LostItem.updateOne({ _id: m.lost._id, status: 'Submitted' }, { status: 'Matched' });
      await notify(m.lost.userId, 'Possible match found',
        `A found item "${item.itemName}" matches your lost ${m.lost.itemName.toLowerCase()} (${m.score}%).`,
        'match', `/items/found/${item._id}`);
    })
  );
  return [];
}

// Deletes a report and everything that points at it, so nothing is left dangling:
// claims on a found item go with it, a lost item's claims just lose the link, plus saved copies,
// abuse reports and the uploaded photo.
export async function deleteItem(kind, doc, { keepAbuseReports = false } = {}) {
  if (kind === 'found') {
    const claims = await Claim.find({ foundItem: doc._id }).select('lostItem');
    await Claim.deleteMany({ foundItem: doc._id });
    // lost reports that were waiting on this item go back to "Matched"
    await LostItem.updateMany({ _id: { $in: claims.map((c) => c.lostItem).filter(Boolean) }, status: 'Claimed' }, { status: 'Matched' });
  } else {
    await Claim.updateMany({ lostItem: doc._id }, { $unset: { lostItem: 1 } });
  }
  await Promise.all([
    keepAbuseReports ? null : AbuseReport.deleteMany({ itemId: doc._id }),
    User.updateMany({ 'savedItems.itemId': doc._id }, { $pull: { savedItems: { itemId: doc._id } } }),
  ]);
  removeUpload(doc.image);
  await doc.deleteOne();
}
