import Claim from '../models/Claim.js';
import FoundItem from '../models/FoundItem.js';
import { nextId } from '../models/Misc.js';
import { EDITABLE } from '../models/itemFields.js';
import { filePath, removeUpload } from '../middleware/upload.js';
import { ApiError, asyncHandler, ok, requireFields, pick, pageParams } from '../utils/helpers.js';
import {
  getModel, itemFilter, shapeItem, withDateAliases, deleteItem, REPORTER_FIELDS,
  runMatchingOnCreate, topMatchesForLost, activeFilter,
} from '../services/itemService.js';
import { rankMatches } from '../services/matching.js';
import { audit, notifyStaff } from '../services/notify.js';

const REQUIRED = ['itemName', 'category', 'description', 'color', 'date', 'location'];
const PREFIX = { lost: 'LF', found: 'FF' };
const isTrue = (v) => v === true || v === 'true';
const ACTIVE_CLAIM = ['Pending', 'Under Review', 'Approved'];

// Builds the five CRUD handlers for either "lost" or "found" reports.
export const itemController = (kind) => {
  const Model = getModel(kind);

  const create = asyncHandler(async (req, res) => {
    const body = withDateAliases(req.body, kind);
    const draft = isTrue(body.draft);
    requireFields(body, draft ? ['itemName'] : REQUIRED);
    const item = await Model.create({
      ...pick(body, EDITABLE),
      userId: req.user._id,
      reportId: await nextId(PREFIX[kind]),
      status: draft ? 'Draft' : kind === 'lost' ? 'Submitted' : 'Pending Verification',
      image: filePath(req.file),
    });
    let matches = [];
    if (!draft) {
      matches = await runMatchingOnCreate(kind, item);
      if (kind === 'found') await notifyStaff('New found item', `${item.itemName} (${item.reportId}) needs verification.`, 'report', `/items/found/${item._id}`, ['staff']);
    }
    await audit(req.user, `CREATE_${kind.toUpperCase()}_REPORT`, item.reportId, item.itemName);
    const fresh = shapeItem(await Model.findById(item._id).populate('userId', REPORTER_FIELDS), kind, req.user);
    ok(res, {
      item: fresh,
      // each match carries both sides and the factor-by-factor breakdown, ready to display
      matches: matches.slice(0, 3).map((m) => ({
        lost: fresh, found: shapeItem(m.found, 'found', req.user),
        score: m.score, confidence: m.confidence, matchedFields: m.matchedFields, breakdown: m.breakdown,
      })),
    }, 201);
  });

  const list = asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const filter = itemFilter(req.query);
    if (req.query.mine === 'true') filter.userId = req.user._id;
    else if (!filter.status) filter.status = { $ne: 'Draft' };
    const [rows, total] = await Promise.all([
      Model.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('userId', REPORTER_FIELDS),
      Model.countDocuments(filter),
    ]);
    const items = rows.map((r) => shapeItem(r, kind, req.user));
    if (kind === 'lost' && req.query.mine === 'true') {
      // "Matches" column on My Reports
      const foundPool = await FoundItem.find({ ...activeFilter, userId: { $ne: req.user._id } }).lean();
      for (const it of items) it.matchCount = rankMatches(it, foundPool).length;
    }
    ok(res, { items, total, page, pages: Math.ceil(total / limit) });
  });

  const getOne = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id).populate('userId', REPORTER_FIELDS);
    if (!doc) throw new ApiError(404, 'Report not found');
    const item = shapeItem(doc, kind, req.user);
    if (doc.status === 'Draft' && !item.isOwner && req.user.role !== 'admin') throw new ApiError(404, 'Report not found');
    item.saved = req.user.savedItems.some((s) => String(s.itemId) === String(doc._id));
    if (kind === 'found') {
      item.myClaim = await Claim.findOne({ foundItem: doc._id, claimant: req.user._id, status: { $in: ACTIVE_CLAIM } }).select('claimId status');
    } else if (item.isOwner || req.user.role === 'admin') {
      item.matchCount = (await topMatchesForLost(doc)).length;
    }
    ok(res, item);
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Report not found');
    const isAdmin = req.user.role === 'admin';
    if (String(doc.userId) !== String(req.user._id) && !isAdmin) throw new ApiError(403, 'You can only edit your own reports');
    if (['Recovered', 'Closed'].includes(doc.status) && !isAdmin) throw new ApiError(400, 'This report is closed and can no longer be edited');
    const body = withDateAliases(req.body, kind);
    Object.assign(doc, pick(body, EDITABLE));
    // photo: a new upload replaces the old one; removeImage=true deletes it. Old files are cleaned up.
    if (req.file) {
      removeUpload(doc.image);
      doc.image = filePath(req.file);
    } else if (isTrue(body.removeImage)) {
      removeUpload(doc.image);
      doc.image = undefined;
    }
    const submitting = doc.status === 'Draft' && body.draft !== undefined && !isTrue(body.draft);
    if (submitting) {
      requireFields(doc, REQUIRED);
      doc.status = kind === 'lost' ? 'Submitted' : 'Pending Verification';
    }
    await doc.save();
    if (submitting) await runMatchingOnCreate(kind, doc);
    await audit(req.user, `UPDATE_${kind.toUpperCase()}_REPORT`, doc.reportId);
    const fresh = await Model.findById(doc._id).populate('userId', REPORTER_FIELDS);
    ok(res, shapeItem(fresh, kind, req.user));
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Report not found');
    const isAdmin = req.user.role === 'admin';
    if (String(doc.userId) !== String(req.user._id) && !isAdmin) throw new ApiError(403, 'You can only delete your own reports');
    if (!isAdmin && ['Claimed', 'Recovered'].includes(doc.status)) throw new ApiError(400, 'Claimed or recovered reports cannot be deleted');
    await deleteItem(kind, doc);
    await audit(req.user, `DELETE_${kind.toUpperCase()}_REPORT`, doc.reportId, doc.itemName);
    ok(res, { message: 'Report deleted' });
  });

  return { create, list, getOne, update, remove };
};
