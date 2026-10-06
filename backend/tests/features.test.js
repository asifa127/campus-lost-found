// Broader API checks: claims review actions, messaging, admin CRUD, abuse, auth edge cases.
// Needs a seeded database and a running API (see demo-flow.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';

import { call, asStudent, asStaff, asAdmin, uid } from './helpers.js';

test('claim review: request info -> respond -> reject; own item cannot be claimed', async () => {
  const student = await asStudent();
  const staff = await asStaff();
  const found = await call('/found?limit=50', { token: student });
  const target = found.data.items.find((f) => f.status === 'Verified' && !f.isOwner && f.itemName !== 'Samsung Galaxy Buds Pro');
  assert.ok(target, 'a claimable found item exists');

  const claim = await call('/claims', { token: student, method: 'POST', body: { foundItemId: target._id, lostLocation: 'Somewhere', lostDate: '2026-10-01', uniqueFeature: 'Sticker on the back' } });
  assert.equal(claim.status, 201);
  assert.equal((await call('/claims', { token: student, method: 'POST', body: { foundItemId: target._id, lostLocation: 'x', lostDate: '2026-10-01', uniqueFeature: 'duplicate claim' } })).status, 409);

  const ask = await call(`/claims/${claim.data._id}`, { token: staff, method: 'PUT', body: { action: 'request_info', comments: 'What brand is it?' } });
  assert.equal(ask.data.status, 'Under Review');
  assert.equal((await call(`/claims/${claim.data._id}`, { token: student, method: 'PUT', body: { action: 'approve' } })).status, 403, 'claimant cannot approve');
  assert.equal((await call(`/claims/${claim.data._id}`, { token: student, method: 'PUT', body: { action: 'respond', comments: 'It is a Samsung' } })).status, 200);
  assert.equal((await call(`/claims/${claim.data._id}`, { token: staff, method: 'PUT', body: { action: 'reject' } })).status, 400, 'rejection needs a reason');
  const rejected = await call(`/claims/${claim.data._id}`, { token: staff, method: 'PUT', body: { action: 'reject', comments: 'Details do not match' } });
  assert.equal(rejected.data.status, 'Rejected');
  assert.equal((await call(`/found/${target._id}`, { token: student })).data.status, 'Verified', 'item is released again');
});

test('messaging hides contact details and tracks unread', async () => {
  const student = await asStudent();
  const staff = await asStaff();
  const me = (await call('/auth/me', { token: student })).data;
  const staffMe = (await call('/auth/me', { token: staff })).data;
  assert.equal((await call('/messages', { token: staff, method: 'POST', body: { to: me._id, text: `hello ${uid}` } })).status, 201);
  assert.ok((await call('/messages/unread', { token: student })).data.unread >= 1);
  const thread = await call(`/messages?with=${staffMe._id}`, { token: student });
  assert.ok(thread.data.messages.some((m) => m.text === `hello ${uid}`));
  assert.ok(!('email' in thread.data.peer) && !('phone' in thread.data.peer));
});

test('admin: user block/unblock, category and location CRUD, abuse flow', async () => {
  const admin = await asAdmin();
  const student = await asStudent();

  const reg = await call('/auth/register', { method: 'POST', body: { name: 'Temp User', studentId: `T${uid}`, email: `t${uid}@campus.com`, phone: '9999999999', password: 'Temp@1234', department: 'CSE', year: '1st Year', role: 'staff' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'student', 'self-registered staff stays a student until approved');
  await call(`/admin/users/${reg.data.user._id}/block`, { token: admin, method: 'PUT' });
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: `t${uid}@campus.com`, password: 'Temp@1234' } })).status, 403);
  await call(`/admin/users/${reg.data.user._id}/unblock`, { token: admin, method: 'PUT' });
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: `t${uid}@campus.com`, password: 'Temp@1234' } })).status, 200);
  assert.equal((await call(`/admin/users/${reg.data.user._id}`, { token: admin, method: 'DELETE' })).status, 200);

  const cat = await call('/admin/categories', { token: admin, method: 'POST', body: { name: `Cat ${uid}` } });
  assert.equal(cat.status, 201);
  assert.equal((await call('/admin/categories', { token: admin, method: 'POST', body: { name: `Cat ${uid}` } })).status, 409);
  await call(`/admin/categories/${cat.data._id}`, { token: admin, method: 'PUT', body: { enabled: false } });
  assert.ok(!(await call('/catalog')).data.categories.some((c) => c._id === cat.data._id), 'disabled category is hidden from forms');
  assert.equal((await call(`/admin/categories/${cat.data._id}`, { token: admin, method: 'DELETE' })).status, 200);
  const electronics = (await call('/catalog')).data.categories.find((c) => c.name === 'Electronics');
  assert.equal((await call(`/admin/categories/${electronics._id}`, { token: admin, method: 'DELETE' })).status, 400, 'category in use cannot be deleted');
  const loc = await call('/admin/locations', { token: admin, method: 'POST', body: { name: `Loc ${uid}` } });
  assert.equal((await call(`/admin/locations/${loc.data._id}`, { token: admin, method: 'DELETE' })).status, 200);
  assert.equal((await call('/admin/categories', { token: student, method: 'POST', body: { name: 'x' } })).status, 403);

  const lost = (await call('/lost?limit=5', { token: admin })).data.items[0];
  const abuse = await call('/abuse', { token: student, method: 'POST', body: { itemType: 'lost', itemId: lost._id, reason: 'Spam' } });
  assert.ok([201, 409].includes(abuse.status));
  const open = (await call('/admin/abuse?status=Open', { token: admin })).data;
  assert.ok(open.length >= 1);
  assert.equal((await call(`/admin/abuse/${open[0]._id}`, { token: admin, method: 'PUT', body: { action: 'dismiss' } })).status, 200);
});

test('analytics are computed, not hard-coded', async () => {
  const admin = await asAdmin();
  const d = (await call('/admin/dashboard', { token: admin })).data;
  const found = (await call('/found?limit=100', { token: admin })).data.total;
  assert.equal(d.cards.foundItems, found - (await call('/found?mine=true&status=Draft', { token: admin })).data.total);
  assert.ok(d.cards.successRate >= 0 && d.cards.successRate <= 100);
  assert.equal(d.lostVsFound.length, 6);
});

test('password reset flow and upload validation', async () => {
  const forgot = await call('/auth/forgot-password', { method: 'POST', body: { email: 'meera.nair@campus.com' } });
  const token = new URL(forgot.data.resetUrl).searchParams.get('token');
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'weak' } })).status, 400);
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'Student@123' } })).status, 200);
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'Student@123' } })).status, 400, 'token is single use');

  const student = await asStudent();
  const form = new FormData();
  form.append('itemName', 'Bad upload');
  form.append('draft', 'true');
  form.append('image', new Blob(['not an image'], { type: 'text/plain' }), 'x.txt');
  assert.equal((await call('/lost', { token: student, method: 'POST', form })).status, 400);
});

test('browse: multi-select filters and category counts', async () => {
  const student = await asStudent();
  const all = (await call('/items?limit=100', { token: student })).data;
  assert.ok(all.facets.category.Electronics > 0);

  const two = (await call('/items?category=Electronics,Keys&limit=100', { token: student })).data;
  assert.ok(two.items.length > 0 && two.items.every((i) => ['Electronics', 'Keys'].includes(i.category)));
  assert.equal(two.facets.category.Electronics, all.facets.category.Electronics, 'counts ignore the category filter itself');

  const colours = (await call('/items?color=Black,Blue&limit=100', { token: student })).data;
  assert.ok(colours.items.length > 0 && colours.items.every((i) => /black|blue/i.test(i.color)));
});
