import mongoose from 'mongoose';
import { itemFields } from './itemFields.js';

const schema = new mongoose.Schema(
  {
    ...itemFields,
    estimatedValue: Number,
    reward: String,
    contactPreference: { type: String, enum: ['in-app', 'phone', 'email'], default: 'in-app' },
  },
  { timestamps: true }
);
// list/browse filters: newest first by status, moderation queue, category facets
schema.index({ status: 1, createdAt: -1 });
schema.index({ flagged: 1 });
schema.index({ category: 1, status: 1 });

export default mongoose.model('LostItem', schema);
