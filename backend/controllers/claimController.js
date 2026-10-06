import Claim from '../models/Claim.js';
import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import { nextId } from '../models/Misc.js';
import { filePath } from '../middleware/upload.js';
import { ApiError, asyncHandler, ok, requireFields, pageParams } from '../utils/helpers.js';
import { audit, notify, notifyStaff } from '../services/notify.js';
import { calculateMatchScore } from '../services/matching.js';
import { activeFilter, shapeItem, REPORTER_FIELDS } from '../services/itemService.js';

const OPEN = ['Pending', 'Under Review'];
const isStaff = (u) => ['staff', 'admin'].includes(u.role);
const step = (label, note, by) => ({ label, note, by, at: new Date() });

const populate = (q) =>
  q.populate('foundItem', 'reportId itemName category image status color brand location userId')
    .populate('lostItem', 'reportId itemName status')
    .populate('claimant', 'name studentId department')
    .populate('reviewedBy', 'name')
    .populate('handover.verifiedBy', 'name');

async function bestScore(claimantId, lostItemId, found) {
  if (lostItemId) {
    const lost = await LostItem.findOne({ _id: lostItemId, userId: claimantId });
    if (!lost) throw new ApiError(400, 'Selected lost report was not found');
    return { lost, score: calculateMatchScore(lost, found).score };
  }
  const mine = await LostItem.find({ userId: claimantId, ...activeFilter });
  let best = { lost: null, score: 0 };
  for (const lost of mine) {
    const score = calculateMatchScore(lost, found).score;
    if (score > best.score) best = { lost, score };
  }
  return best;
}

export const create = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['foundItemId', 'lostLocation', 'lostDate', 'uniqueFeature']);
  const found = await FoundItem.findById(b.foundItemId);
  if (!found || ['Draft', 'Recovered', 'Closed'].includes(found.status)) throw new ApiError(400, 'This item is not available to claim');
  if (await Claim.exists({ foundItem: found._id, status: 'Approved' })) throw new ApiError(400, 'This item has been approved for another claimant and is waiting for handover');
  if (String(found.userId) === String(req.user._id)) throw new ApiError(400, 'You cannot claim an item you reported as found');
  if (await Claim.exists({ foundItem: found._id, claimant: req.user._id, status: { $in: [...OPEN, 'Approved'] } })) {
    throw new ApiError(409, 'You already have an active claim for this item');
  }
  const { lost, score } = await bestScore(req.user._id, b.lostItemId || null, found);

  const claim = await Claim.create({
    claimId: await nextId('CL'),
    foundItem: found._id,
    lostItem: lost?._id,
    claimant: req.user._id,
    answers: { lostLocation: b.lostLocation, lostDate: b.lostDate, uniqueFeature: b.uniqueFeature, additional: b.additional },
    evidence: filePath(req.file),
    matchScore: score,
    timeline: [step('Claim Submitted', 'Claim submitted for review', req.user._id)],
  });
  found.status = 'Claimed';
  await found.save();
  if (lost) await LostItem.updateOne({ _id: lost._id }, { status: 'Claimed' });

  await notify(req.user._id, 'Claim submitted', `Your claim ${claim.claimId} for "${found.itemName}" is pending review.`, 'claim', `/claims/${claim._id}`);
  await notifyStaff('New claim to review', `${req.user.name} claimed "${found.itemName}" (${claim.claimId}).`, 'claim', `/claims/${claim._id}`);
  await audit(req.user, 'CREATE_CLAIM', claim.claimId, found.reportId);
  ok(res, claim, 201);
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 20);
  const filter = {};
  // /api/claims is "my claims" for everyone; /api/admin/claims (staff/admin only, enforced in the router) is the full queue.
  const reviewQueue = req.originalUrl.startsWith('/api/admin/claims');
  if (!reviewQueue) filter.claimant = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  const [rows, total] = await Promise.all([
    populate(Claim.find(filter).sort('-createdAt').skip(skip).limit(limit)),
    Claim.countDocuments(filter),
  ]);
  ok(res, { items: rows, total, page, pages: Math.ceil(total / limit) });
});

export const getOne = asyncHandler(async (req, res) => {
  const claim = await populate(Claim.findById(req.params.id)).populate('timeline.by', 'name');
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (!claim.foundItem || !claim.claimant) throw new ApiError(404, 'The item or user for this claim no longer exists');
  const mine = String(claim.claimant._id) === String(req.user._id);
  if (!mine && !isStaff(req.user)) throw new ApiError(403, 'You cannot view this claim');
  const data = claim.toObject();
  if (isStaff(req.user)) {
    const full = await Claim.findById(claim._id).populate('claimant', 'name studentId email phone department year');
    data.claimant = full.claimant.toObject();
    const [lostReports, claims] = await Promise.all([
      LostItem.countDocuments({ userId: claim.claimant._id }),
      Claim.find({ claimant: claim.claimant._id, _id: { $ne: claim._id } }).select('claimId status').lean(),
    ]);
    data.claimantHistory = { lostReports, claims };
  }
  // Non-staff claimants only see item info already visible to everyone.
  data.foundItemFull = isStaff(req.user)
    ? shapeItem(await FoundItem.findById(claim.foundItem._id).populate('userId', REPORTER_FIELDS), 'found', req.user)
    : undefined;
  // Why this pair scored what it did (only built from the attributes both sides already show publicly).
  if (claim.lostItem) {
    const [lostDoc, foundDoc] = await Promise.all([LostItem.findById(claim.lostItem._id), FoundItem.findById(claim.foundItem._id)]);
    if (lostDoc && foundDoc) data.matchDetail = calculateMatchScore(lostDoc, foundDoc);
  }
  ok(res, data);
});

// PUT /api/claims/:id   body.action: under_review | approve | reject | request_info | cancel | respond
export const update = asyncHandler(async (req, res) => {
  const { action, comments } = req.body;
  const claim = await Claim.findById(req.params.id);
  if (!claim) throw new ApiError(404, 'Claim not found');
  const found = await FoundItem.findById(claim.foundItem);
  const mine = String(claim.claimant) === String(req.user._id);
  const link = `/claims/${claim._id}`;
  const staffActions = ['under_review', 'approve', 'reject', 'request_info'];

  if (staffActions.includes(action) && !isStaff(req.user)) throw new ApiError(403, 'Only staff or admin can review claims');
  if (['cancel', 'respond'].includes(action) && !mine) throw new ApiError(403, 'Only the claimant can do that');
  if (!staffActions.concat(['cancel', 'respond']).includes(action)) throw new ApiError(400, 'Unknown action');
  if (!OPEN.includes(claim.status)) throw new ApiError(400, `This claim is already ${claim.status.toLowerCase()}`);

  const releaseItems = async () => {
    const stillClaimed = await Claim.exists({ foundItem: claim.foundItem, _id: { $ne: claim._id }, status: { $in: [...OPEN, 'Approved'] } });
    if (found && !stillClaimed) { found.status = found.verifiedAt ? 'Verified' : 'Pending Verification'; await found.save(); }
    if (claim.lostItem) await LostItem.updateOne({ _id: claim.lostItem }, { status: 'Matched' });
  };

  if (action === 'under_review') {
    claim.status = 'Under Review';
    claim.reviewedBy = req.user._id;
    claim.timeline.push(step('Under Review', comments, req.user._id));
    await notify(claim.claimant, 'Claim under review', `Your claim ${claim.claimId} is now under review.`, 'claim', link);
  } else if (action === 'request_info') {
    requireFields(req.body, ['comments']);
    claim.status = 'Under Review';
    claim.reviewedBy = req.user._id;
    claim.infoRequest = comments;
    claim.timeline.push(step('More information requested', comments, req.user._id));
    await notify(claim.claimant, 'Additional information needed', `Your claim ${claim.claimId} requires additional information: ${comments}`, 'claim', link);
  } else if (action === 'respond') {
    requireFields(req.body, ['comments']);
    claim.answers.additional = [claim.answers.additional, comments].filter(Boolean).join('\n\n');
    claim.infoRequest = undefined;
    claim.timeline.push(step('Claimant responded', comments, req.user._id));
    await notifyStaff('Claim updated', `${req.user.name} responded on claim ${claim.claimId}.`, 'claim', link);
  } else if (action === 'cancel') {
    claim.status = 'Cancelled';
    claim.timeline.push(step('Cancelled by claimant', comments, req.user._id));
    await releaseItems();
  } else if (action === 'reject') {
    requireFields(req.body, ['comments']);
    claim.status = 'Rejected';
    claim.reviewedBy = req.user._id;
    claim.reviewComments = comments;
    claim.resolvedAt = new Date();
    claim.timeline.push(step('Rejected', comments, req.user._id));
    await releaseItems();
    await notify(claim.claimant, 'Claim rejected', `Your claim ${claim.claimId} was not approved. Reason: ${comments}`, 'claim', link);
  } else if (action === 'approve') {
    claim.status = 'Approved';
    claim.reviewedBy = req.user._id;
    claim.reviewComments = comments;
    claim.resolvedAt = new Date();
    claim.timeline.push(step('Approved', comments, req.user._id));
    // The item stays "Claimed" until the handover is completed; only then is it "Recovered".
    if (found) { found.status = 'Claimed'; await found.save(); }
    if (claim.lostItem) await LostItem.updateOne({ _id: claim.lostItem }, { status: 'Claimed' });
    // Any competing open claims on the same item are closed automatically.
    const rivals = await Claim.find({ foundItem: claim.foundItem, _id: { $ne: claim._id }, status: { $in: OPEN } });
    for (const r of rivals) {
      r.status = 'Rejected';
      r.reviewComments = 'Another claim for this item was approved';
      r.resolvedAt = new Date();
      r.timeline.push(step('Rejected', r.reviewComments, req.user._id));
      await r.save();
      await notify(r.claimant, 'Claim rejected', `Claim ${r.claimId} was closed because the item was returned to another claimant.`, 'claim', `/claims/${r._id}`);
    }
    await notify(claim.claimant, 'Claim approved', `Your claim ${claim.claimId} has been approved. Staff will arrange the handover.`, 'claim', link);
    await notify(found.userId, 'Your found item has been claimed', `"${found.itemName}" (${found.reportId}) was claimed by its owner. Staff will arrange the handover.`, 'claim', `/items/found/${found._id}`);
  }
  await claim.save();
  await audit(req.user, `CLAIM_${action.toUpperCase()}`, claim.claimId, comments || '');
  ok(res, claim);
});

// PUT /api/claims/:id/handover   body.action: schedule | complete
export const handover = asyncHandler(async (req, res) => {
  if (!isStaff(req.user)) throw new ApiError(403, 'Only staff or admin can manage handovers');
  const claim = await Claim.findById(req.params.id);
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (claim.status !== 'Approved') throw new ApiError(400, 'Handover is only available for approved claims');
  const { action, date, location, receiverConfirmed } = req.body;
  const link = `/claims/${claim._id}`;

  if (action === 'schedule') {
    requireFields(req.body, ['date', 'location']);
    claim.handover = { status: 'Scheduled', date, location, verifiedBy: req.user._id };
    claim.timeline.push(step('Handover scheduled', `${location} on ${new Date(date).toDateString()}`, req.user._id));
    await notify(claim.claimant, 'Handover scheduled', `Collect your item at ${location} on ${new Date(date).toDateString()}.`, 'handover', link);
  } else if (action === 'complete') {
    if (claim.handover?.status !== 'Scheduled') throw new ApiError(400, 'Schedule the handover first');
    if (!(receiverConfirmed === true || receiverConfirmed === 'true')) throw new ApiError(400, 'Receiver confirmation is required');
    claim.handover.status = 'Completed';
    claim.handover.receiverConfirmed = true;
    claim.handover.completedAt = new Date();
    claim.handover.verifiedBy = req.user._id;
    claim.status = 'Completed';
    claim.timeline.push(step('Handover completed', 'Item successfully recovered', req.user._id));
    // The owner has the item back: this is the moment the reports become "Recovered".
    const found = await FoundItem.findById(claim.foundItem);
    if (found) { found.status = 'Recovered'; await found.save(); }
    if (claim.lostItem) await LostItem.updateOne({ _id: claim.lostItem }, { status: 'Recovered' });
    await notify(claim.claimant, 'Item recovered', 'Item Successfully Recovered 🎉', 'handover', link);
    if (found) await notify(found.userId, 'Item returned to its owner', `"${found.itemName}" (${found.reportId}) is back with its owner. Thank you!`, 'handover', `/items/found/${found._id}`);
  } else throw new ApiError(400, 'Unknown action');
  await claim.save();
  await audit(req.user, `HANDOVER_${action.toUpperCase()}`, claim.claimId);
  ok(res, claim);
});
