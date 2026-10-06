import mongoose from 'mongoose';

const ref = (name) => ({ type: mongoose.Schema.Types.ObjectId, ref: name });
const createdOnly = { createdAt: true, updatedAt: false };

// Small helper so every model declares its own indexes next to its fields.
function make(name, fields, { timestamps = true, indexes = [] } = {}) {
  const schema = new mongoose.Schema(fields, { timestamps });
  indexes.forEach((spec) => schema.index(spec));
  return mongoose.model(name, schema);
}

export const Notification = make('Notification', {
  userId: { ...ref('User'), required: true },
  title: String,
  message: String,
  type: { type: String, default: 'system' },
  link: String,
  read: { type: Boolean, default: false },
}, { timestamps: createdOnly, indexes: [{ userId: 1, read: 1, createdAt: -1 }] });

export const Message = make('Message', {
  from: { ...ref('User'), required: true },
  to: { ...ref('User'), required: true },
  text: { type: String, required: true, maxlength: 1000 },
  itemRef: { itemType: String, itemId: mongoose.Schema.Types.ObjectId, reportId: String, itemName: String },
  read: { type: Boolean, default: false },
}, { timestamps: createdOnly, indexes: [{ from: 1, to: 1, createdAt: -1 }, { to: 1, read: 1 }] });

export const Category = make('Category', {
  name: { type: String, required: [true, 'Name is required'], unique: true, trim: true, maxlength: 40 },
  enabled: { type: Boolean, default: true },
});

export const Location = make('Location', {
  name: { type: String, required: [true, 'Name is required'], unique: true, trim: true, maxlength: 60 },
  enabled: { type: Boolean, default: true },
});

// "Report" in the original brief: a user flagging an item as abusive. Named AbuseReport so it
// does not clash with lost/found *reports*.
export const AbuseReport = make('AbuseReport', {
  itemType: { type: String, enum: ['lost', 'found'], required: true },
  itemId: { ...ref('LostItem'), required: true },
  reportId: String,
  itemName: String,
  reporter: { ...ref('User'), required: true },
  reason: { type: String, required: true, maxlength: 60 },
  details: { type: String, maxlength: 500 },
  status: { type: String, enum: ['Open', 'Dismissed', 'Resolved'], default: 'Open' },
  handledBy: ref('User'),
}, { indexes: [{ status: 1, createdAt: -1 }, { itemId: 1, status: 1 }] });

export const AuditLog = make('AuditLog', {
  user: ref('User'),
  action: String,
  target: String,
  details: String,
}, { timestamps: createdOnly, indexes: [{ createdAt: -1 }] });

// One document (key "app") holding admin-editable settings. Notification switches are enforced in services/notify.js.
export const Setting = make('Setting', {
  key: { type: String, default: 'app', unique: true },
  appName: { type: String, default: 'Campus Lost & Found', trim: true, maxlength: 60 },
  institutionName: { type: String, default: 'Campus College', trim: true, maxlength: 80 },
  contactEmail: { type: String, default: '', trim: true, lowercase: true, maxlength: 120 },
  supportContact: { type: String, default: '', trim: true, maxlength: 120 },
  notifications: {
    enabled: { type: Boolean, default: true },
    claims: { type: Boolean, default: true },
    matches: { type: Boolean, default: true },
  },
});

export const Counter = make('Counter', { _id: String, seq: { type: Number, default: 0 } }, { timestamps: false });

export async function nextId(prefix) {
  const year = new Date().getFullYear();
  const c = await Counter.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return `${prefix}-${year}-${String(c.seq).padStart(5, '0')}`;
}
