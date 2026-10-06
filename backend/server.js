import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '../frontend/dist');

const app = express();
// Behind a hosting proxy (Render) the real client address is in X-Forwarded-For; trust one hop so rate limits see it.
if (env.isProd) app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // the report forms preview a chosen photo as a blob: URL
  contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'] } },
}));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
// 600 requests per minute per IP in production; relaxed in development so demos and test runs are never throttled.
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: env.isProd ? 600 : 6000, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests' } }));
app.use('/api', routes);

// In production one service serves the built React app as well (npm run build), so a single URL is enough.
// Any other GET falls back to index.html so client-side routes such as /dashboard work on refresh.
if (env.isProd && fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  app.use(express.static(WEB_DIR));
  app.get(/^\/(?!(?:api|uploads)(?:\/|$)).*/, (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

// First start of a fresh demo deployment: load the demo data once, and only when the database has no users at all.
async function seedIfEmpty() {
  if (process.env.SEED_DEMO_DATA !== 'true' || (await User.estimatedDocumentCount()) > 0) return;
  console.log('SEED_DEMO_DATA=true and the database is empty: loading demo data');
  const run = spawnSync(process.execPath, [path.join(here, 'seeds/seed.js')], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('Demo data could not be loaded');
}

connectDB()
  .then(seedIfEmpty)
  .then(() => app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`)))
  .catch((err) => {
    console.error('Could not start the API:', err.message);
    process.exit(1);
  });
