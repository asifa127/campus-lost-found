import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
// 600 requests per minute per IP in production; relaxed in development so demos and test runs are never throttled.
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: env.isProd ? 600 : 6000, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests' } }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
