import { policy } from '../config/policy.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const label = (f) => f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function requireFields(body, fields) {
  for (const f of fields) {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === '') throw new ApiError(400, `${label(f)} is required`);
  }
}

// Request values can arrive as arrays or objects; coerce before calling string methods.
export const text = (v) => (v === undefined || v === null ? '' : String(v).trim());

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
export const isStrongPassword = (s) =>
  typeof s === 'string' && s.length >= policy.password.minLength && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);
export const PASSWORD_RULE = policy.password.rule;

export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export function pageParams(query, defLimit = 12) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
