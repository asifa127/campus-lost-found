import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import { ApiError, asyncHandler, ok } from '../utils/helpers.js';
import { shapeItem, topMatchesForLost, activeFilter, REPORTER_FIELDS } from '../services/itemService.js';
import { rankMatches } from '../services/matching.js';

const present = (lost, m, viewer) => ({
  lost: shapeItem(lost, 'lost', viewer),
  found: shapeItem(m.found, 'found', viewer),
  score: m.score,
  confidence: m.confidence,
  matchedFields: m.matchedFields,
  breakdown: m.breakdown,
});

// Every potential match across one user's open lost reports, best first.
export async function userMatches(user) {
  const [myLost, found] = await Promise.all([
    LostItem.find({ userId: user._id, ...activeFilter }).populate('userId', REPORTER_FIELDS).lean(),
    FoundItem.find({ ...activeFilter, userId: { $ne: user._id } }).populate('userId', REPORTER_FIELDS).lean(),
  ]);
  return myLost.flatMap((lost) => rankMatches(lost, found).map((m) => present(lost, m, user))).sort((a, b) => b.score - a.score);
}

// GET /api/matches/:lostItemId  -> ranked found items for one lost report
export const forLostItem = asyncHandler(async (req, res) => {
  const lost = await LostItem.findById(req.params.lostItemId);
  if (!lost) throw new ApiError(404, 'Lost report not found');
  if (String(lost.userId) !== String(req.user._id) && req.user.role === 'student') throw new ApiError(403, 'You can only view matches for your own reports');
  const matches = await topMatchesForLost(lost, 20);
  ok(res, matches.map((m) => present(lost, m, req.user)));
});

// GET /api/matches -> every potential match across the viewer's own lost reports
export const mine = asyncHandler(async (req, res) => ok(res, await userMatches(req.user)));
