// End-to-end check of the symposium demo against a running API (npm run seed && npm run start first).
// Run: npm test --prefix backend
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchScore, nameSimilarity } from '../services/matching.js';

import { call, asStudent, asOtherStudent, asStaff, asAdmin, today } from './helpers.js';

test('matching: spec example scores as a high match', () => {
  const r = calculateMatchScore(
    { itemName: 'Black Samsung Galaxy Buds', category: 'Electronics', color: 'Black', brand: 'Samsung', location: 'Library', date: '2026-10-05' },
    { itemName: 'Samsung earbuds black', category: 'Electronics', color: 'Black', brand: 'Samsung', location: 'Library', date: '2026-10-05' }
  );
  assert.ok(r.score >= 80 && r.confidence === 'High Confidence', JSON.stringify(r));
  // the breakdown explains the score: its points add up to it
  assert.equal(Math.round(r.breakdown.reduce((sum, row) => sum + row.points, 0)), r.score);
  assert.deepEqual(r.breakdown.map((row) => row.key), ['category', 'name', 'color', 'brand', 'location', 'date']);
  assert.deepEqual(calculateMatchScore({ itemName: 'Calculator', category: 'Books' }, { itemName: 'Wallet', category: 'Wallets' }).confidence, null);
  // everyday synonyms and plurals count as the same word
  assert.equal(nameSimilarity('Buds', 'Earphones'), 1);
  assert.equal(nameSimilarity('Spectacles', 'Black frame glasses'), 0.5);
  assert.equal(nameSimilarity('Black Samsung Earbuds', 'Samsung Galaxy Buds Pro').toFixed(3), '0.571');
});

test('student -> lost report -> match -> claim -> staff approval -> handover -> recovered', async () => {
  const student = await asStudent();
  const staff = await asStaff();

  const created = await call('/lost', {
    token: student, method: 'POST',
    body: {
      itemName: 'Black Samsung Earbuds', category: 'Electronics', description: 'Wireless earbuds in black case', brand: 'Samsung',
      color: 'Black', location: 'Library', building: 'Library Block', date: new Date().toISOString().slice(0, 10),
    },
  });
  assert.equal(created.status, 201);
  assert.match(created.data.item.reportId, /^LF-\d{4}-\d{5}$/);
  const top = created.data.matches[0];
  assert.ok(top.score >= 85, `expected a strong match, got ${top.score}`);
  assert.equal(top.found.itemName, 'Samsung Galaxy Buds Pro');

  const claim = await call('/claims', {
    token: student, method: 'POST',
    body: { foundItemId: top.found._id, lostItemId: created.data.item._id, lostLocation: 'Library', lostDate: '2026-10-05', uniqueFeature: 'Scratch on the case lid' },
  });
  // JSON body is accepted too; multipart is what the UI sends.
  assert.equal(claim.status, 201);
  assert.equal(claim.data.status, 'Pending');

  assert.equal((await call('/admin/claims', { token: student })).status, 403, 'students cannot open the review queue');
  const review = await call(`/claims/${claim.data._id}`, { token: staff, method: 'PUT', body: { action: 'approve', comments: 'Verified' } });
  assert.equal(review.data.status, 'Approved');

  // approved is not recovered yet: the item is only reserved for its owner until the handover is done
  const claimedFound = await call(`/found/${top.found._id}`, { token: student });
  assert.equal(claimedFound.data.status, 'Claimed');
  const titles = async () => (await call('/notifications', { token: student })).data.items.map((n) => n.title);
  const before = await titles();
  assert.ok(before.includes('Claim approved'));

  // nobody else can claim it meanwhile
  const rival = await call('/claims', {
    token: await asOtherStudent(), method: 'POST',
    body: { foundItemId: top.found._id, lostLocation: 'Library', lostDate: today(), uniqueFeature: 'Black case with a scratch on the lid' },
  });
  assert.equal(rival.status, 400);
  assert.match(rival.message, /approved for another claimant/);

  // handover: schedule first, then the receiver's confirmation completes it
  const handover = (body) => call(`/claims/${claim.data._id}/handover`, { token: staff, method: 'PUT', body });
  assert.equal((await handover({ action: 'complete', receiverConfirmed: true })).status, 400, 'cannot complete before it is scheduled');
  const scheduled = await handover({ action: 'schedule', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), location: 'Security Office' });
  assert.equal(scheduled.status, 200);
  assert.equal(scheduled.data.handover.status, 'Scheduled');
  assert.equal((await call(`/found/${top.found._id}`, { token: student })).data.status, 'Claimed', 'scheduling does not recover the item');
  assert.equal((await handover({ action: 'complete' })).status, 400, 'the receiver must confirm');
  const recoveredCount = async () => (await call('/admin/dashboard', { token: await asAdmin() })).data.cards.recoveredItems;
  const recoveredBefore = await recoveredCount();
  const completed = await handover({ action: 'complete', receiverConfirmed: true });
  assert.equal(completed.data.status, 'Completed');
  assert.equal(await recoveredCount(), recoveredBefore + 1, 'the admin dashboard counts it as recovered only now');

  // now it is recovered, for the found report and the owner's lost report, and the owner is told
  assert.equal((await call(`/found/${top.found._id}`, { token: student })).data.status, 'Recovered');
  assert.equal((await call(`/lost/${created.data.item._id}`, { token: student })).data.status, 'Recovered');
  const count = (list) => list.filter((t) => t === 'Item recovered').length;
  assert.equal(count(await titles()), count(before) + 1, 'one new "Item recovered" notification');
});

test('authorization and validation', async () => {
  const student = await asStudent();
  assert.equal((await call('/admin/users', { token: student })).status, 403);
  assert.equal((await call('/lost')).status, 401);
  const weak = await call('/auth/register', { method: 'POST', body: { name: 'X', studentId: 'Z1', email: 'x@y.com', phone: '1', password: 'abc', department: 'CSE', year: '1st Year' } });
  assert.equal(weak.status, 400);
  const dup = await call('/auth/register', { method: 'POST', body: { name: 'X', studentId: 'Z1', email: 'student@campus.com', phone: '1', password: 'Abcdef12', department: 'CSE', year: '1st Year' } });
  assert.equal(dup.status, 409);
});
