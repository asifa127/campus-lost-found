import mongoose from 'mongoose';

const ref = (name) => ({ type: mongoose.Schema.Types.ObjectId, ref: name });
export const CLAIM_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Cancelled', 'Completed'];

const schema = new mongoose.Schema(
  {
    claimId: { type: String, unique: true },
    foundItem: { ...ref('FoundItem'), required: true, index: true },
    lostItem: ref('LostItem'),
    claimant: { ...ref('User'), required: true, index: true },
    answers: {
      lostLocation: String,
      lostDate: Date,
      uniqueFeature: String,
      additional: String,
    },
    evidence: String,
    matchScore: { type: Number, default: 0 },
    status: { type: String, enum: CLAIM_STATUSES, default: 'Pending', index: true },
    infoRequest: String,
    reviewedBy: ref('User'),
    reviewComments: { type: String, maxlength: 1000 },
    resolvedAt: Date,
    handover: {
      status: { type: String, enum: ['Scheduled', 'Completed'] },
      date: Date,
      location: String,
      verifiedBy: ref('User'),
      receiverConfirmed: Boolean,
      completedAt: Date,
    },
    timeline: [{ _id: false, label: String, note: String, by: ref('User'), at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);
schema.index({ claimant: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ lostItem: 1 });

export default mongoose.model('Claim', schema);
