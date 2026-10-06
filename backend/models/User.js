import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { policy } from '../config/policy.js';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'] },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student', index: true },
    requestedRole: String,
    studentId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    year: { type: String, trim: true },
    status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
    profileImage: String,
    notificationPrefs: {
      matches: { type: Boolean, default: true },
      claims: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
    },
    savedItems: [{ _id: false, itemType: String, itemId: mongoose.Schema.Types.ObjectId }],
    resetToken: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

schema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, policy.bcryptRounds);
});
schema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};
schema.set('toJSON', {
  transform: (_, o) => {
    delete o.password;
    delete o.resetToken;
    delete o.resetExpires;
    delete o.__v;
    return o;
  },
});

export default mongoose.model('User', schema);
