import mongoose from 'mongoose';
import { itemFields } from './itemFields.js';

const schema = new mongoose.Schema(
  {
    ...itemFields,
    status: { ...itemFields.status, default: 'Pending Verification' },
    currentLocation: { type: String, trim: true },
    foundBy: { type: String, trim: true },
  },
  { timestamps: true }
);
// list/browse filters: newest first by status, moderation queue, category facets
schema.index({ status: 1, createdAt: -1 });
schema.index({ flagged: 1 });
schema.index({ category: 1, status: 1 });

export default mongoose.model('FoundItem', schema);
