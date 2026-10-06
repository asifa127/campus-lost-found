import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/helpers.js';
import { policy } from '../config/policy.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(dir, '../uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const badFile = () => new ApiError(400, policy.upload.message);

// Layer 1: declared mime type + size. The extension comes from the mime type, never from the user's filename.
const single = (field) =>
  multer({
    storage: multer.diskStorage({
      destination: UPLOAD_DIR,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
    }),
    limits: { fileSize: policy.upload.maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badFile())),
  }).single(field);

// Layer 2: the first bytes of the saved file must really be a JPEG, PNG or WEBP.
// A client can label any file "image/png", so the declared type alone is not trusted.
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function verifyContent(req, res, next) {
  if (!req.file) return next();
  try {
    const handle = await fs.promises.open(req.file.path, 'r');
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    await handle.close();
    if (sniff(head) !== req.file.mimetype) throw badFile();
    next();
  } catch (err) {
    removeUpload(req.file.filename);
    next(err instanceof ApiError ? err : badFile());
  }
}

// Use as: router.post('/x', ...uploadImage('image'), handler)
export const uploadImage = (field) => [single(field), verifyContent];

export const filePath = (file) => (file ? `/uploads/${file.filename}` : undefined);

// Deletes a stored upload ("/uploads/abc.jpg" or "abc.jpg"). Only the file name is used, so it cannot leave the upload folder.
export function removeUpload(ref) {
  if (!ref) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(String(ref))), () => {});
}
