import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { policy } from '../config/policy.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/helpers.js';

// Role is always read from the database, never from the token or the client.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please log in to continue');
  let payload;
  try {
    // pinning the algorithm rejects "alg: none" and algorithm-confusion tokens
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError(401, 'Session expired. Please log in again');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'Account no longer exists');
  if (user.status === 'blocked') throw new ApiError(403, 'Your account has been blocked. Contact the administrator');
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to do that'));
  next();
};

export const signToken = (id, remember) =>
  jwt.sign({ id }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${remember ? policy.session.rememberDays : policy.session.standardDays}d`,
  });
