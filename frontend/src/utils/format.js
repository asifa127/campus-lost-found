import {
  Laptop, IdCard, BookOpen, Watch, KeyRound, Wallet, FileText, Shirt, Package,
} from 'lucide-react';

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const today = () => new Date().toISOString().slice(0, 10);

export function timeAgo(d) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d)) / 1000));
  const steps = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [secs, unit] of steps) if (s >= secs) return `${Math.floor(s / secs)}${unit} ago`;
  return 'just now';
}

export const CATEGORY_ICONS = {
  Electronics: Laptop, 'ID Cards': IdCard, Books: BookOpen, Accessories: Watch, Keys: KeyRound,
  Wallets: Wallet, Documents: FileText, Clothing: Shirt, Other: Package,
};
export const categoryIcon = (name) => CATEGORY_ICONS[name] || Package;

// Badge tones per status keyword.
export const STATUS_TONE = {
  Draft: 'slate', Submitted: 'blue', 'Pending Verification': 'amber', Verified: 'teal', 'Under Review': 'violet',
  Matched: 'indigo', Claimed: 'orange', Recovered: 'green', Closed: 'slate',
  Pending: 'amber', Approved: 'green', Rejected: 'red', Cancelled: 'slate', Completed: 'green',
  active: 'green', blocked: 'red', Open: 'amber', Dismissed: 'slate', Resolved: 'green',
};

// Confidence bands from the Smart Matching Algorithm: 80-100 High Confidence, 60-79 Possible Match, 40-59 Low Match.
export const CONFIDENCE_TONE = { 'High Confidence': 'green', 'Possible Match': 'amber', 'Low Match': 'slate' };
export const FIELD_LABELS = { category: 'Same Category', name: 'Similar Item Name', color: 'Same Color', brand: 'Same Brand', location: 'Same Location', date: 'Close Dates' };

// Image uploads: the same rule the server enforces (backend/config/policy.js).
export const MAX_IMAGE_MB = 5;
export const IMAGE_ERROR = `Please upload a JPG, PNG, or WEBP image under ${MAX_IMAGE_MB} MB.`;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const validateImage = (file) => (IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_MB * 1024 * 1024 ? '' : IMAGE_ERROR);
export const fileSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export const fmtNumber = (n) => Number(n || 0).toLocaleString('en-IN');
// "+11.4" / "+25": whole numbers stay whole
export const fmtPoints = (n) => `+${Number.isInteger(n) ? n : n.toFixed(1)}`;
export const RANGE_LABEL = { all: 'All time', today: 'Today', week: 'This week', month: 'This month' };

export const COLORS = ['Black', 'White', 'Grey', 'Blue', 'Red', 'Green', 'Yellow', 'Brown', 'Silver', 'Pink', 'Orange', 'Purple'];
// Item colours are catalogue data, so each swatch is a fixed value.
const SWATCH = {
  Black: 'oklch(0.24 0.005 260)', White: 'oklch(0.97 0.003 90)', Grey: 'oklch(0.7 0.005 260)', Blue: 'oklch(0.55 0.15 255)',
  Red: 'oklch(0.58 0.2 27)', Green: 'oklch(0.6 0.14 150)', Yellow: 'oklch(0.86 0.16 95)', Brown: 'oklch(0.45 0.07 55)',
  Silver: 'oklch(0.86 0.005 260)', Pink: 'oklch(0.8 0.1 355)', Orange: 'oklch(0.72 0.16 55)', Purple: 'oklch(0.5 0.16 305)',
};
export const COLOR_OPTIONS = COLORS.map((value) => ({ value, label: value, swatch: SWATCH[value] }));

// Inline animation-delay for staggered entrances (pair with the `enter` / `swap` classes).
export const stagger = (index, step = 60, offset = 0) => ({ animationDelay: `${offset + index * step}ms` });

export const BUILDINGS = ['Main Block', 'Library Block', 'Mechanical Block', 'ECE Block', 'Hostel Block', 'Admin Block', 'Sports Complex'];
export const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Administration', 'Library', 'Security Office', 'Student Affairs'];
export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Staff'];
export const ITEM_STATUSES = ['Draft', 'Submitted', 'Pending Verification', 'Verified', 'Under Review', 'Matched', 'Claimed', 'Recovered', 'Closed'];
export const CLAIM_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Cancelled', 'Completed'];
export const ABUSE_REASONS = ['Fake report', 'Spam', 'Wrong information', 'Fraudulent claim', 'Inappropriate content', 'Other'];
export const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
