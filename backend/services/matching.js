// Smart Matching Algorithm: scores a lost report against a found report out of 100.
// It is a transparent, rule-based comparison (no trained model):
//   Category 25 + Item name 20 + Color 15 + Brand 15 + Location 15 + Date proximity 10 = 100

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'with', 'my', 'for', 'in', 'on', 'new', 'old']);
// Everyday synonyms so "earbuds" and "buds" (or "spectacles" and "glasses") count as the same word.
const SYNONYMS = {
  buds: 'earbud', earbuds: 'earbud', earphones: 'earbud', earphone: 'earbud', airpods: 'earbud', earpods: 'earbud',
  spectacles: 'glasses', eyeglasses: 'glasses', specs: 'glasses', spectacle: 'glasses',
  bag: 'backpack', rucksack: 'backpack', pendrive: 'usb', flashdrive: 'usb', thumbdrive: 'usb',
  mobile: 'phone', smartphone: 'phone', cellphone: 'phone', purse: 'wallet', flask: 'bottle', tumbler: 'bottle',
  adapter: 'charger', adaptor: 'charger', keys: 'key', keychain: 'key', idcard: 'id', notebooks: 'notebook',
  book: 'notebook', diary: 'notebook', wristwatch: 'watch', laptop: 'laptop', notebookpc: 'laptop',
};

const singular = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

// Synonym first, then plural -> singular, so a synonym and the word it stands for always end up identical
// ("spectacles" and "glasses" both become "glasse").
const tokens = (text = '') =>
  new Set(
    String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w && !STOP.has(w))
      .map((w) => singular(SYNONYMS[w] || SYNONYMS[singular(w)] || w))
  );

// Dice coefficient: 2 * shared words / (words in A + words in B)
export function nameSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((w) => B.has(w)).length;
  return (2 * shared) / (A.size + B.size);
}

const norm = (s) => String(s || '').trim().toLowerCase();
const DAY = 86400000;

export const CONFIDENCE = { high: 'High Confidence', possible: 'Possible Match', low: 'Low Match' };
export const confidenceOf = (score) =>
  score >= 80 ? CONFIDENCE.high : score >= 60 ? CONFIDENCE.possible : score >= 40 ? CONFIDENCE.low : null;

// Returns { score, matchedFields, confidence, breakdown }.
// `breakdown` lists every factor with the points it earned, so the UI can explain *why* a pair matched.
export function calculateMatchScore(lost, found) {
  const breakdown = [];
  const add = (key, label, points, max, matched, note) => breakdown.push({ key, label, points, max, matched, note });

  const sameCategory = !!norm(lost.category) && norm(lost.category) === norm(found.category);
  add('category', 'Category', sameCategory ? 25 : 0, 25, sameCategory, sameCategory ? found.category : 'Different category');

  const sim = nameSimilarity(lost.itemName, found.itemName);
  add('name', 'Name similarity', Math.round(sim * 200) / 10, 20, sim >= 0.4, `${Math.round(sim * 100)}% word match`);

  const lc = tokens(lost.color);
  const fc = tokens(found.color);
  const sameColor = lc.size > 0 && fc.size > 0 && [...lc].some((w) => fc.has(w));
  add('color', 'Color', sameColor ? 15 : 0, 15, sameColor, sameColor ? found.color : lc.size && fc.size ? 'Different color' : 'Not provided');

  const lb = norm(lost.brand);
  const fb = norm(found.brand);
  const sameBrand = !!lb && !!fb && (lb === fb || lb.includes(fb) || fb.includes(lb));
  add('brand', 'Brand', sameBrand ? 15 : 0, 15, sameBrand, sameBrand ? found.brand : lb && fb ? 'Different brand' : 'Not provided');

  const sameLocation = !!norm(lost.location) && norm(lost.location) === norm(found.location);
  const sameBuilding = !sameLocation && !!norm(lost.building) && norm(lost.building) === norm(found.building);
  add('location', 'Location', sameLocation ? 15 : sameBuilding ? 8 : 0, 15, sameLocation, sameLocation ? found.location : sameBuilding ? 'Same building' : 'Different location');

  if (lost.date && found.date) {
    const days = Math.abs(new Date(found.date) - new Date(lost.date)) / DAY;
    const pts = days <= 1 ? 10 : days <= 3 ? 8 : days <= 7 ? 5 : days <= 14 ? 2 : 0;
    add('date', 'Date proximity', pts, 10, pts >= 5, days < 1 ? 'Same day' : `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} apart`);
  } else {
    add('date', 'Date proximity', 0, 10, false, 'No date');
  }

  const score = Math.round(Math.min(100, breakdown.reduce((sum, row) => sum + row.points, 0)));
  return { score, matchedFields: breakdown.filter((r) => r.matched).map((r) => r.key), confidence: confidenceOf(score), breakdown };
}

// Rank candidates for one report; anything under 40 is not recommended.
export function rankMatches(lost, foundList, min = 40) {
  return foundList
    .map((found) => ({ found, ...calculateMatchScore(lost, found) }))
    .filter((m) => m.score >= min)
    .sort((a, b) => b.score - a.score);
}
