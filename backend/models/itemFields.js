import mongoose from 'mongoose';

// Shared by LostItem and FoundItem. `date`/`time` hold the lost-on / found-on moment.
export const ITEM_STATUSES = [
  'Draft', 'Submitted', 'Pending Verification', 'Verified', 'Under Review', 'Matched', 'Claimed', 'Recovered', 'Closed',
];
export const CLOSED_STATUSES = ['Recovered', 'Closed', 'Draft'];

export const itemFields = {
  reportId: { type: String, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemName: { type: String, required: [true, 'Item name is required'], trim: true, maxlength: 120 },
  category: { type: String, trim: true, index: true, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 2000 },
  brand: { type: String, trim: true, maxlength: 60 },
  color: { type: String, trim: true, maxlength: 40 },
  model: { type: String, trim: true, maxlength: 80 },
  uniqueFeatures: { type: String, trim: true, maxlength: 500 },
  date: Date,
  time: String,
  location: { type: String, trim: true, maxlength: 80 },
  building: { type: String, trim: true, maxlength: 60 },
  floor: { type: String, trim: true, maxlength: 30 },
  locationDetails: { type: String, trim: true, maxlength: 200 },
  image: String,
  status: { type: String, enum: ITEM_STATUSES, default: 'Submitted', index: true },
  flagged: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
};

// Fields a reporter may set through the API (everything else is server controlled).
export const EDITABLE = [
  'itemName', 'category', 'description', 'brand', 'color', 'model', 'uniqueFeatures', 'date', 'time',
  'location', 'building', 'floor', 'locationDetails', 'estimatedValue', 'reward', 'contactPreference',
  'currentLocation', 'foundBy',
];
