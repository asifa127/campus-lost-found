import { ApiError } from '../utils/helpers.js';
import { policy } from '../config/policy.js';
import { removeUpload } from './upload.js';

export const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyPattern || {})[0] || 'Value'} already exists`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = ['LIMIT_FILE_SIZE', 'LIMIT_UNEXPECTED_FILE'].includes(err.code) ? policy.upload.message : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request is too large';
  }
  // A failed request must never leave an orphaned upload on disk.
  if (req.file) removeUpload(req.file.filename);
  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong';
  }
  res.status(status).json({ success: false, message });
}
