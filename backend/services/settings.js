import { Setting } from '../models/Misc.js';

// Settings are read on almost every request that creates a notification, so keep them for a few seconds.
let cache = null;
let cachedAt = 0;
const TTL_MS = 5000;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const doc = (await Setting.findOne({ key: 'app' }).lean()) || (await Setting.create({ key: 'app' })).toObject();
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

export const clearSettingsCache = () => { cache = null; };
