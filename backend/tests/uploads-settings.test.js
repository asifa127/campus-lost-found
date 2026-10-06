// Image handling, admin settings, notification switches, system status and the password-reset flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ORIGIN, PNG, call, asStudent, asAdmin, imageForm, lostPayload, registerUser, login, uid } from './helpers.js';

const UPLOADS = fileURLToPath(new URL('../uploads/', import.meta.url));
const files = () => fs.readdirSync(UPLOADS).filter((f) => f !== '.gitkeep');
const settle = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const MESSAGE = 'Please upload a JPG, PNG, or WEBP image under 5 MB.';
const exists = async (path) => (await fetch(ORIGIN + path)).status === 200;

test('images: JPG, PNG and WEBP are accepted and served; everything else is rejected with one clear message', async () => {
  const student = await asStudent();
  const before = files().length;

  const png = await call('/lost', { token: student, method: 'POST', form: imageForm(lostPayload({ draft: 'true' })) });
  assert.equal(png.status, 201);
  assert.match(png.data.item.image, /^\/uploads\/[0-9a-f]{24}\.png$/, 'random server-side name, extension from the validated type');
  const res = await fetch(ORIGIN + png.data.item.image);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');

  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32)]);
  const ok = [await call('/lost', { token: student, method: 'POST', form: imageForm(lostPayload({ draft: 'true' }), { bytes: jpeg, type: 'image/jpeg', name: 'a.jpeg' }) }),
    await call('/lost', { token: student, method: 'POST', form: imageForm(lostPayload({ draft: 'true' }), { bytes: webp, type: 'image/webp', name: 'a.webp' }) })];
  assert.deepEqual(ok.map((r) => r.status), [201, 201]);

  const bad = {
    'text file labelled as PNG': { bytes: Buffer.from('this is not an image at all'), type: 'image/png', name: 'fake.png' },
    'PNG labelled as JPEG': { bytes: PNG, type: 'image/jpeg', name: 'mismatch.jpg' },
    GIF: { bytes: Buffer.from('GIF89a\u0001\u0000\u0001\u0000'), type: 'image/gif', name: 'a.gif' },
    SVG: { bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), type: 'image/svg+xml', name: 'x.svg' },
    PDF: { bytes: Buffer.from('%PDF-1.4'), type: 'application/pdf', name: 'a.pdf' },
    'file over 5 MB': { bytes: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 16)]), type: 'image/png', name: 'huge.png' },
  };
  const mid = files().length;
  for (const [label, opts] of Object.entries(bad)) {
    const r = await call('/lost', { token: student, method: 'POST', form: imageForm(lostPayload({ draft: 'true' }), opts) });
    assert.equal(r.status, 400, label);
    assert.equal(r.message, MESSAGE, label);
  }
  await settle();
  assert.equal(files().length, mid, 'rejected uploads leave nothing behind on disk');

  // a valid file on an otherwise invalid request is cleaned up too
  assert.equal((await call('/lost', { token: student, method: 'POST', form: imageForm({ itemName: '' }) })).status, 400);
  await settle();
  assert.equal(files().length, mid, 'failed validation does not orphan the upload');
  assert.equal(before + 3, mid, 'only the three valid uploads were stored');
  for (const r of [png, ...ok]) await call(`/lost/${r.data.item._id}`, { token: student, method: 'DELETE' });
  await settle();
  assert.equal(files().length, before, 'deleting a report deletes its photo');
});

test('images: replace and remove clean up the old file', async () => {
  const student = await asStudent();
  const created = (await call('/lost', { token: student, method: 'POST', form: imageForm(lostPayload({ draft: 'true' })) })).data.item;
  const first = created.image;
  assert.ok(await exists(first));

  const replaced = (await call(`/lost/${created._id}`, { token: student, method: 'PUT', form: imageForm({ itemName: created.itemName }, { name: 'second.png' }) })).data;
  assert.notEqual(replaced.image, first);
  await settle();
  assert.equal(await exists(first), false, 'old photo removed after a replace');
  assert.ok(await exists(replaced.image));

  const removed = (await call(`/lost/${created._id}`, { token: student, method: 'PUT', form: imageForm({ itemName: created.itemName, removeImage: 'true' }, { bytes: null }) })).data;
  assert.equal(removed.image, undefined);
  await settle();
  assert.equal(await exists(replaced.image), false, 'photo removed after "remove image"');

  // the same rules apply to a bad replacement: the existing photo survives
  const again = (await call(`/lost/${created._id}`, { token: student, method: 'PUT', form: imageForm({ itemName: created.itemName }, { name: 'third.png' }) })).data;
  const rejected = await call(`/lost/${created._id}`, { token: student, method: 'PUT', form: imageForm({ itemName: 'Changed' }, { bytes: Buffer.from('nope'), name: 'bad.png' }) });
  assert.equal(rejected.status, 400);
  assert.ok(await exists(again.image), 'a rejected replacement keeps the current photo');
  await call(`/lost/${created._id}`, { token: student, method: 'DELETE' });
});

test('images: profile photo can be replaced and removed', async () => {
  const { data } = await registerUser();
  const token = data.token;
  const withPhoto = (await call('/auth/profile', { token, method: 'PUT', form: imageForm({}, { field: 'avatar' }) })).data;
  assert.match(withPhoto.profileImage, /^\/uploads\//);
  assert.equal((await call('/auth/profile', { token, method: 'PUT', form: imageForm({}, { field: 'avatar', bytes: Buffer.from('x'), name: 'a.png' }) })).status, 400);
  const without = (await call('/auth/profile', { token, method: 'PUT', body: { removeAvatar: true } })).data;
  assert.equal(without.profileImage, undefined);
  await settle();
  assert.equal(await exists(withPhoto.profileImage), false);
  await call(`/admin/users/${data.user._id}`, { token: await asAdmin(), method: 'DELETE' });
});

test('settings: admin can read, validate, save and the branding is public', async () => {
  const admin = await asAdmin();
  const original = (await call('/admin/settings', { token: admin })).data;
  try {
    assert.ok(original.appName && original.institutionName);
    assert.equal(typeof original.notifications.enabled, 'boolean');

    for (const bad of [{ appName: 'x' }, { appName: 'y'.repeat(61) }, { contactEmail: 'not-an-email' }, { institutionName: '' }, { notifications: { claims: 'yes' } }]) {
      assert.equal((await call('/admin/settings', { token: admin, method: 'PUT', body: bad })).status, 400, JSON.stringify(bad));
    }
    const saved = await call('/admin/settings', {
      token: admin, method: 'PUT',
      body: { appName: `Expo ${uid}`, institutionName: 'Expo College', contactEmail: 'Help@Expo.Edu', supportContact: 'Room 12', notifications: { matches: false } },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.contactEmail, 'help@expo.edu', 'normalised to lower case');
    assert.equal(saved.data.notifications.matches, false);
    assert.equal(saved.data.notifications.claims, original.notifications.claims, 'untouched switches keep their value');

    const pub = (await call('/public/settings')).data;
    assert.equal(pub.appName, `Expo ${uid}`);
    assert.deepEqual(Object.keys(pub).sort(), ['appName', 'contactEmail', 'institutionName', 'supportContact'], 'only branding is public');
    assert.ok((await call('/admin/audit?q=UPDATE_SETTINGS', { token: admin })).data.items.length > 0, 'changes are audited');
  } finally {
    await call('/admin/settings', {
      token: admin, method: 'PUT',
      body: { appName: original.appName, institutionName: original.institutionName, contactEmail: original.contactEmail, supportContact: original.supportContact, notifications: original.notifications },
    });
  }
});

test('settings: the notification switches really stop notifications', async () => {
  const [admin, student] = [await asAdmin(), await asStudent()];
  const original = (await call('/admin/settings', { token: admin })).data.notifications;
  const matchAlerts = async () => (await call('/notifications', { token: student })).data.items.filter((n) => n.title === 'Possible match found').length;
  // matches the seeded "House Keys with Red Keychain" found report
  const keys = (n) => lostPayload({ itemName: `House Keys ${n}`, category: 'Keys', color: 'Silver', location: 'Hostel', building: 'Hostel Block' });
  const made = [];
  try {
    const base = await matchAlerts();
    await call('/admin/settings', { token: admin, method: 'PUT', body: { notifications: { enabled: true, matches: false } } });
    made.push((await call('/lost', { token: student, method: 'POST', body: keys('a') })).data.item._id);
    assert.equal(await matchAlerts(), base, 'match alerts off -> nothing created');

    await call('/admin/settings', { token: admin, method: 'PUT', body: { notifications: { matches: true } } });
    made.push((await call('/lost', { token: student, method: 'POST', body: keys('b') })).data.item._id);
    assert.equal(await matchAlerts(), base + 1, 'match alerts on -> notification created');

    await call('/admin/settings', { token: admin, method: 'PUT', body: { notifications: { enabled: false } } });
    made.push((await call('/lost', { token: student, method: 'POST', body: keys('c') })).data.item._id);
    assert.equal(await matchAlerts(), base + 1, 'master switch off -> nothing created');
  } finally {
    await call('/admin/settings', { token: admin, method: 'PUT', body: { notifications: original } });
    for (const id of made) await call(`/lost/${id}`, { token: student, method: 'DELETE' });
  }
});

test('system status: environment, API and database are reported to admins', async () => {
  const sys = (await call('/admin/system', { token: await asAdmin() })).data;
  assert.ok(['development', 'production'].includes(sys.environment));
  assert.equal(sys.api.status, 'online');
  assert.ok(sys.api.uptimeSeconds >= 0 && /^v\d+/.test(sys.api.nodeVersion));
  assert.equal(sys.database.status, 'connected');
  assert.ok(sys.database.name);
  assert.equal(sys.email.configured, false, 'no SMTP server is configured, and the API says so');
  assert.equal(sys.storage.maxUploadMb, 5);
  assert.equal(sys.passwordPolicy.minLength, 8);
});

test('password reset: link -> new password -> login (development shows the link, production never does)', async () => {
  const { body } = await registerUser();
  const email = body.email;

  const forgot = await call('/auth/forgot-password', { method: 'POST', body: { email } });
  assert.equal(forgot.status, 200);
  assert.equal(forgot.data.message, 'If this account exists, a password reset link has been generated.');
  assert.equal(forgot.data.devOnly, true, 'development build flags the link as dev-only');
  const token = new URL(forgot.data.resetUrl).searchParams.get('token');

  const unknown = await call('/auth/forgot-password', { method: 'POST', body: { email: `nobody${uid}@campus.com` } });
  assert.equal(unknown.data.message, forgot.data.message, 'same answer for unknown accounts');
  assert.equal(unknown.data.resetUrl, undefined);

  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'weak' } })).status, 400);
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token: 'f'.repeat(48), password: 'Brand@New1' } })).status, 400, 'unknown token');
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'Brand@New1' } })).status, 200);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email, password: body.password } })).status, 401, 'old password stops working');
  assert.ok(await login(email, 'Brand@New1'), 'new password works');
  assert.equal((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'Another@123' } })).status, 400, 'the link works once');

  // a second API instance in production mode must not expose the link
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', PORT: '5055' },
  });
  try {
    const prod = 'http://localhost:5055/api';
    for (let i = 0; i < 40; i++) { if ((await fetch(`${prod}/health`).catch(() => null))?.ok) break; await settle(250); }
    const res = await call('/auth/forgot-password', { method: 'POST', body: { email }, base: prod });
    assert.equal(res.status, 200);
    assert.equal(res.data.message, forgot.data.message);
    assert.equal(res.data.resetUrl, undefined, 'production: no reset link in the response');
    assert.equal(res.data.devOnly, undefined);
    assert.equal((await call('/admin/system', { token: await asAdmin(), base: prod })).data.environment, 'production');
  } finally {
    child.kill();
  }
  await call(`/admin/users/${(await call('/auth/login', { method: 'POST', body: { email, password: 'Brand@New1' } })).data.user._id}`, { token: await asAdmin(), method: 'DELETE' });
});
