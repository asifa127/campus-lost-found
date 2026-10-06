// Security review checks: every rule is enforced by the API itself, not just by the frontend routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { API, call, asStudent, asOtherStudent, asStaff, asAdmin, registerUser, lostPayload, uid } from './helpers.js';

const ANY_ID = '000000000000000000000001';

test('unauthenticated requests are rejected on every protected endpoint', async () => {
  const protectedGets = ['/auth/me', '/lost', '/found', '/items', '/claims', '/notifications', '/messages', '/matches', '/dashboard',
    '/admin/staff', '/admin/dashboard', '/admin/users', '/admin/reports', '/admin/claims', '/admin/analytics', '/admin/audit',
    '/admin/abuse', '/admin/settings', '/admin/system', '/catalog/all', `/lost/${ANY_ID}`, `/found/${ANY_ID}`, `/matches/${ANY_ID}`, `/claims/${ANY_ID}`];
  for (const path of protectedGets) assert.equal((await call(path)).status, 401, `GET ${path}`);
  for (const [method, path] of [['POST', '/lost'], ['POST', '/found'], ['POST', '/claims'], ['POST', '/messages'], ['PUT', '/notifications/read-all'], ['PUT', '/admin/settings']]) {
    assert.equal((await call(path, { method, body: {} })).status, 401, `${method} ${path}`);
  }
  // the only public endpoints
  for (const path of ['/health', '/public/stats', '/public/recent', '/public/settings', '/catalog']) assert.equal((await call(path)).status, 200, path);
});

test('a student cannot reach any staff or admin API', async () => {
  const student = await asStudent();
  const forbidden = [['GET', '/admin/staff'], ['GET', '/admin/dashboard'], ['GET', '/admin/users'], ['GET', '/admin/reports'], ['GET', '/admin/claims'],
    ['GET', '/admin/analytics'], ['GET', '/admin/audit'], ['GET', '/admin/abuse'], ['GET', '/admin/settings'], ['GET', '/admin/system'], ['GET', '/catalog/all'],
    ['PUT', '/admin/settings'], ['POST', '/admin/categories'], ['POST', '/admin/locations'], ['PUT', `/admin/users/${ANY_ID}`], ['PUT', `/admin/users/${ANY_ID}/block`],
    ['DELETE', `/admin/users/${ANY_ID}`], ['PUT', `/admin/reports/lost/${ANY_ID}/verify`], ['PUT', `/admin/reports/lost/${ANY_ID}/status`], ['PUT', `/admin/abuse/${ANY_ID}`]];
  for (const [method, path] of forbidden) assert.equal((await call(path, { token: student, method, body: {} })).status, 403, `${method} ${path}`);
});

test('staff can use staff tools but not admin-only tools', async () => {
  const staff = await asStaff();
  for (const path of ['/admin/staff', '/admin/reports', '/admin/claims']) assert.equal((await call(path, { token: staff })).status, 200, path);
  for (const path of ['/admin/dashboard', '/admin/users', '/admin/analytics', '/admin/audit', '/admin/abuse', '/admin/settings', '/admin/system']) {
    assert.equal((await call(path, { token: staff })).status, 403, path);
  }
  assert.equal((await call(`/admin/users/${ANY_ID}`, { token: staff, method: 'PUT', body: { role: 'admin' } })).status, 403);
});

test('a student cannot approve claims or modify another user\'s reports', async () => {
  const [alice, bob, staff] = [await asStudent(), await asOtherStudent(), await asStaff()];
  const mine = (await call('/lost', { token: alice, method: 'POST', body: lostPayload({ draft: true }) })).data.item;
  assert.equal((await call(`/lost/${mine._id}`, { token: bob, method: 'PUT', body: { itemName: 'Hijacked' } })).status, 403);
  assert.equal((await call(`/lost/${mine._id}`, { token: bob, method: 'DELETE' })).status, 403);
  assert.equal((await call(`/lost/${mine._id}`, { token: bob })).status, 404, 'other users cannot even see a draft');

  const pending = (await call('/admin/claims?status=Pending', { token: staff })).data.items[0];
  for (const action of ['approve', 'reject', 'request_info', 'under_review']) {
    assert.equal((await call(`/claims/${pending._id}`, { token: alice, method: 'PUT', body: { action, comments: 'x' } })).status, 403, action);
  }
  assert.equal((await call(`/claims/${pending._id}/handover`, { token: alice, method: 'PUT', body: { action: 'schedule' } })).status, 403);
  assert.equal((await call(`/claims/${pending._id}`, { token: bob })).status, 403, 'only the claimant and staff may open a claim');
  await call(`/lost/${mine._id}`, { token: alice, method: 'DELETE' });
});

test('a user cannot make themselves an admin', async () => {
  const { data, body } = await registerUser({ role: 'admin' });
  assert.equal(data.user.role, 'student', 'registering with role=admin is ignored');
  const token = data.token;

  const profile = await call('/auth/profile', { token, method: 'PUT', body: { name: 'Renamed', role: 'admin', status: 'active', email: 'x@y.com' } });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.role, 'student');
  assert.equal(profile.data.email, body.email, 'email cannot be changed here either');
  assert.equal(profile.data.name, 'Renamed');
  assert.equal((await call('/admin/users', { token })).status, 403);
  assert.equal((await call(`/admin/users/${data.user._id}`, { token, method: 'PUT', body: { role: 'admin' } })).status, 403);
  assert.equal((await call('/auth/me', { token })).data.role, 'student');
});

test('forged, unsigned and tampered tokens are rejected', async () => {
  const admin = await asAdmin();
  const me = (await call('/auth/me', { token: admin })).data;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

  const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: me._id })}.`;
  assert.equal((await call('/auth/me', { token: unsigned })).status, 401, 'alg=none');
  assert.equal((await call('/auth/me', { token: jwt.sign({ id: me._id }, 'not-the-real-secret') })).status, 401, 'wrong secret');
  const [h, , sig] = admin.split('.');
  assert.equal((await call('/auth/me', { token: `${h}.${b64({ id: ANY_ID })}.${sig}` })).status, 401, 'payload swapped, signature kept');
  const hs512 = jwt.sign({ id: me._id }, 'whatever', { algorithm: 'HS512' });
  assert.equal((await call('/auth/me', { token: hs512 })).status, 401, 'other algorithm');
  assert.equal((await call('/auth/me', { token: 'garbage' })).status, 401);
});

test('blocked and deleted users lose access immediately', async () => {
  const [admin, { data }] = [await asAdmin(), await registerUser()];
  assert.equal((await call('/auth/me', { token: data.token })).status, 200);
  await call(`/admin/users/${data.user._id}/block`, { token: admin, method: 'PUT' });
  assert.equal((await call('/auth/me', { token: data.token })).status, 403);
  await call(`/admin/users/${data.user._id}`, { token: admin, method: 'DELETE' });
  assert.equal((await call('/auth/me', { token: data.token })).status, 401);
});

test('private details are only visible to the reporter and staff', async () => {
  const [owner, other, staff] = [await asStudent(), await asOtherStudent(), await asStaff()];
  const created = (await call('/lost', { token: owner, method: 'POST', body: lostPayload({ uniqueFeatures: 'Serial number ZX-9981', estimatedValue: 4500 }) })).data.item;
  const view = async (token) => (await call(`/lost/${created._id}`, { token })).data;
  assert.equal((await view(owner)).uniqueFeatures, 'Serial number ZX-9981');
  assert.equal((await view(staff)).uniqueFeatures, 'Serial number ZX-9981');
  const seen = await view(other);
  assert.equal(seen.uniqueFeatures, undefined);
  assert.equal(seen.estimatedValue, undefined);
  assert.ok(!JSON.stringify((await call('/lost?limit=100', { token: other })).data).includes('ZX-9981'), 'not leaked through the list either');

  // found items: where they are kept and the hidden identifying details
  const found = (await call('/found?limit=100', { token: other })).data.items.find((f) => !f.isOwner);
  for (const f of ['uniqueFeatures', 'currentLocation', 'foundBy']) assert.equal(found[f], undefined, f);
  await call(`/lost/${created._id}`, { token: owner, method: 'DELETE' });
});

test('passwords and reset tokens never appear in any response', async () => {
  const [student, admin] = [await asStudent(), await asAdmin()];
  const login = await call('/auth/login', { method: 'POST', body: { email: 'student@campus.com', password: 'Student@123' } });
  const dumps = [login, await call('/auth/me', { token: student }), await call('/admin/users?limit=50', { token: admin })];
  for (const d of dumps) assert.ok(!/"password"|"resetToken"|"resetExpires"|\$2[aby]\$/.test(JSON.stringify(d)), 'no secrets in response');
});

test('malformed input is rejected cleanly instead of crashing', async () => {
  const student = await asStudent();
  const bad = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ not json' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).success, false);

  assert.equal((await call('/auth/login', { method: 'POST', body: { email: { $gt: '' }, password: { $gt: '' } } })).status, 401, 'operator injection is not interpreted');
  assert.equal((await call('/auth/register', { method: 'POST', body: { name: 'x', studentId: ['a'], email: { a: 1 }, phone: '1', password: 'Abcdef12', department: 'CSE', year: '1st Year' } })).status, 400);
  assert.equal((await call('/lost/not-an-id', { token: student })).status, 400);
  assert.equal((await call(`/lost/${ANY_ID}`, { token: student })).status, 404);
  assert.equal((await call('/items?q=a&q=b&category=Keys&category=Books', { token: student })).status, 200, 'repeated query keys are tolerated');
  assert.equal((await call('/lost', { token: student, method: 'POST', body: lostPayload({ itemName: 'x'.repeat(500) }) })).status, 400, 'over-long values are rejected');
  assert.equal((await call('/lost', { token: student, method: 'POST', body: { itemName: 'Only a name' } })).status, 400, 'required fields are enforced');
  assert.equal((await call('/messages', { token: student, method: 'POST', body: { to: ANY_ID, text: { a: 1 } } })).status, 404);
});

test('registration validates input and never trusts the client for privileges', async () => {
  const weak = await registerUser({ password: 'password' });
  assert.equal(weak.status, 400);
  assert.match(weak.message, /Password must be/);
  assert.equal((await registerUser({ email: 'not-an-email' })).status, 400);
  assert.equal((await registerUser({ confirmPassword: 'Different@1' })).status, 400);
  const first = await registerUser();
  assert.equal(first.status, 201);
  assert.equal((await call('/auth/register', { method: 'POST', body: { ...first.body, studentId: `X${uid}` } })).status, 409, 'duplicate email');
  assert.equal((await call('/auth/register', { method: 'POST', body: { ...first.body, email: `other${uid}@campus.com` } })).status, 409, 'duplicate id');
  const admin = await asAdmin();
  await call(`/admin/users/${first.data.user._id}`, { token: admin, method: 'DELETE' });
});

test('admin role management: promotions are explicit, logged and notified', async () => {
  const admin = await asAdmin();
  const staffRequest = await registerUser({ role: 'staff' });
  assert.equal(staffRequest.data.user.role, 'student', 'a staff sign-up starts as a student');
  assert.equal(staffRequest.data.user.requestedRole, 'staff');
  const id = staffRequest.data.user._id;
  const token = staffRequest.data.token;
  assert.equal((await call('/admin/staff', { token })).status, 403, 'no staff tools before approval');

  assert.equal((await call(`/admin/users/${id}`, { token: admin, method: 'PUT', body: { role: 'superuser' } })).status, 400, 'unknown role');
  const approved = await call(`/admin/users/${id}`, { token: admin, method: 'PUT', body: { role: 'staff' } });
  assert.equal(approved.data.role, 'staff');
  assert.equal(approved.data.requestedRole, undefined, 'request is cleared once approved');
  assert.equal((await call('/admin/staff', { token })).status, 200, 'staff tools unlock after approval');
  assert.ok((await call('/notifications', { token })).data.items.some((n) => n.title === 'Your role was updated'));
  const log = (await call('/admin/audit?q=CHANGE_USER_ROLE', { token: admin })).data.items[0];
  assert.match(log.details, /student -> staff/);

  const me = (await call('/auth/me', { token: admin })).data;
  assert.equal((await call(`/admin/users/${me._id}`, { token: admin, method: 'PUT', body: { role: 'student' } })).status, 400, 'admins cannot demote themselves');

  const declined = await registerUser({ role: 'staff' });
  const res = await call(`/admin/users/${declined.data.user._id}`, { token: admin, method: 'PUT', body: { declineStaffRequest: true } });
  assert.equal(res.data.role, 'student');
  assert.equal(res.data.requestedRole, undefined);
  for (const u of [id, declined.data.user._id]) await call(`/admin/users/${u}`, { token: admin, method: 'DELETE' });
});

test('API contract: key endpoints return the documented status codes', async () => {
  const [student, staff, admin] = [await asStudent(), await asStaff(), await asAdmin()];
  const expectations = [
    // [method, path, token, body, expected status]
    ['POST', '/auth/login', null, { email: 'student@campus.com', password: 'wrong' }, 401],
    ['POST', '/auth/login', null, { email: 'student@campus.com' }, 400],
    ['GET', '/auth/me', student, null, 200],
    ['GET', '/lost?limit=5', student, null, 200],
    ['GET', '/found?limit=5', student, null, 200],
    ['POST', '/found', student, { itemName: 'No other fields' }, 400],
    ['GET', '/matches', student, null, 200],
    ['GET', `/matches/${ANY_ID}`, student, null, 404],
    ['GET', '/claims', student, null, 200],
    ['POST', '/claims', student, { foundItemId: ANY_ID, lostLocation: 'x', lostDate: '2026-01-01', uniqueFeature: 'x' }, 400],
    ['GET', `/claims/${ANY_ID}`, student, null, 404],
    ['GET', '/notifications', student, null, 200],
    ['PUT', `/notifications/${ANY_ID}/read`, student, null, 404],
    ['GET', '/messages', student, null, 200],
    ['POST', '/messages', student, { to: ANY_ID, text: 'hi' }, 404],
    ['GET', '/admin/dashboard', admin, null, 200],
    ['GET', '/admin/users', admin, null, 200],
    ['GET', '/admin/reports', staff, null, 200],
    ['GET', '/admin/claims', staff, null, 200],
    ['GET', '/admin/analytics', admin, null, 200],
    ['GET', '/no-such-route', student, null, 404],
  ];
  for (const [method, path, token, body, expected] of expectations) {
    const res = await call(path, { token, method, body });
    assert.equal(res.status, expected, `${method} ${path} -> ${res.status} ${res.message || ''}`);
    if (expected >= 400) assert.equal(res.success, false, 'errors use the { success: false, message } shape');
  }
});
