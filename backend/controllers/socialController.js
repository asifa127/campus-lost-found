import mongoose from 'mongoose';
import User from '../models/User.js';
import { Notification, Message, AbuseReport } from '../models/Misc.js';
import { ApiError, asyncHandler, ok, requireFields, text as str } from '../utils/helpers.js';
import { getModel } from '../services/itemService.js';
import { notify, notifyStaff, audit } from '../services/notify.js';

// ---- notifications ----
export const listNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: req.user._id }).sort('-createdAt').limit(100),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);
  ok(res, { items, unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found');
  ok(res, n);
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  ok(res, { message: 'All notifications marked as read' });
});

// ---- messages ----
// GET /api/messages            -> conversation list
// GET /api/messages?with=<id>  -> thread with one user (marks it read)
export const getMessages = asyncHandler(async (req, res) => {
  const me = req.user._id;
  if (req.query.with) {
    const peer = await User.findById(req.query.with).select('name role department');
    if (!peer) throw new ApiError(404, 'User not found');
    await Message.updateMany({ from: peer._id, to: me, read: false }, { read: true });
    const thread = await Message.find({ $or: [{ from: me, to: peer._id }, { from: peer._id, to: me }] }).sort('createdAt').limit(200);
    return ok(res, { peer, messages: thread });
  }
  const meId = new mongoose.Types.ObjectId(me);
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: meId }, { to: meId }] } },
    { $addFields: { peer: { $cond: [{ $eq: ['$from', meId] }, '$to', '$from'] } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$peer',
        last: { $first: '$$ROOT' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to', meId] }, { $eq: ['$read', false] }] }, 1, 0] } },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name role department');
  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
  ok(res, rows.filter((r) => byId[String(r._id)]).map((r) => ({ peer: byId[String(r._id)], lastMessage: r.last, unread: r.unread })));
});

export const sendMessage = asyncHandler(async (req, res) => {
  requireFields(req.body, ['to', 'text']);
  const to = await User.findById(req.body.to);
  if (!to || to.status === 'blocked') throw new ApiError(404, 'Recipient not found');
  if (String(to._id) === String(req.user._id)) throw new ApiError(400, 'You cannot message yourself');
  let itemRef;
  if (req.body.itemType && req.body.itemId) {
    const item = await getModel(req.body.itemType).findById(req.body.itemId).select('reportId itemName');
    if (item) itemRef = { itemType: req.body.itemType, itemId: item._id, reportId: item.reportId, itemName: item.itemName };
  }
  const msg = await Message.create({ from: req.user._id, to: to._id, text: str(req.body.text).slice(0, 1000), itemRef });
  await notify(to._id, 'New message', `${req.user.name}: ${msg.text.slice(0, 80)}`, 'message', `/messages?with=${req.user._id}`);
  ok(res, msg, 201);
});

export const unreadMessageCount = asyncHandler(async (req, res) => {
  ok(res, { unread: await Message.countDocuments({ to: req.user._id, read: false }) });
});

// ---- abuse reports ----
export const reportAbuse = asyncHandler(async (req, res) => {
  requireFields(req.body, ['itemType', 'itemId', 'reason']);
  const Model = getModel(req.body.itemType);
  const item = await Model.findById(req.body.itemId);
  if (!item) throw new ApiError(404, 'Item not found');
  if (await AbuseReport.exists({ itemId: item._id, reporter: req.user._id, status: 'Open' })) {
    throw new ApiError(409, 'You have already reported this item');
  }
  const report = await AbuseReport.create({
    itemType: req.body.itemType, itemId: item._id, reportId: item.reportId, itemName: item.itemName,
    reporter: req.user._id, reason: req.body.reason, details: req.body.details,
  });
  item.flagged = true;
  await item.save();
  await notifyStaff('Item flagged', `${item.reportId} was reported: ${report.reason}`, 'system', '/admin/abuse', ['admin']);
  await audit(req.user, 'REPORT_ABUSE', item.reportId, report.reason);
  ok(res, report, 201);
});
