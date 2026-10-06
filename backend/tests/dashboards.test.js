// Dashboards and analytics (admin + staff), landing statistics, match explanations, date naming and cascades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, call, asStudent, asOtherStudent, asStaff, asAdmin, imageForm, lostPayload, today } from './helpers.js';

test('admin dashboard: every time range works and the time series matches its granularity', async () => {
  const admin = await asAdmin();
  const now = new Date();
  const dash = async (range) => (await call(`/admin/dashboard${range ? `?range=${range}` : ''}`, { token: admin })).data;
  const all = await dash();
  const expected = { all: 6, today: now.getHours() + 1, week: 7, month: now.getDate() };
  for (const [range, buckets] of Object.entries(expected)) {
    const d = await dash(range);
    assert.equal(d.range, range);
    assert.equal(d.lostVsFound.length, buckets, `${range}: ${buckets} buckets`);
    assert.equal(d.recoveryTrend.length, buckets);
    assert.ok(d.cards.lostItems <= all.cards.lostItems && d.cards.foundItems <= all.cards.foundItems, `${range} is a subset of all time`);
    assert.equal(d.cards.totalUsers, all.cards.totalUsers, 'users are not range dependent');
    assert.equal(d.cards.successRate, all.cards.successRate, 'recovery rate is always all-time');
  }
  assert.equal((await dash('nonsense')).range, 'all', 'unknown ranges fall back to all time');
  assert.ok(all.last30Days && all.last30Days.lost <= all.cards.lostItems, 'items added in the last 30 days are shown for all time');
  assert.equal((await dash('week')).last30Days, null);

  // the chart series add up to the cards for the same range (week: counted by report date)
  const week = await dash('week');
  assert.equal(week.lostVsFound.reduce((s, b) => s + b.Lost, 0), week.cards.lostItems);
  assert.equal(week.lostVsFound.reduce((s, b) => s + b.Found, 0), week.cards.foundItems);
});

test('admin dashboard: overview panels and attention queues come from the database', async () => {
  const admin = await asAdmin();
  const d = (await call('/admin/dashboard', { token: admin })).data;
  const { users, reports, recovery, claims } = d.overview;
  assert.equal(users.total, users.students + users.staff + users.admins);
  assert.equal(users.total, d.cards.totalUsers);
  assert.equal(reports.lost, d.cards.lostItems);
  assert.equal(reports.found, d.cards.foundItems);
  assert.equal(claims.pending + claims.underReview, d.cards.pendingClaims);
  assert.ok(recovery.rate >= 0 && recovery.rate <= 100 && claims.approvalRate >= 0 && claims.approvalRate <= 100);
  assert.equal(d.pendingVerification, reports.pendingVerification);
  assert.equal(d.flagged, reports.flagged);
  assert.ok(d.activity.length > 0 && d.activity.every((a) => a.action !== 'LOGIN'), 'the activity feed shows actions, not sign-ins');

  const { pendingClaims, awaitingVerification, flagged } = d.attention;
  for (const list of [pendingClaims, awaitingVerification, flagged]) assert.ok(Array.isArray(list) && list.length <= 5);
  assert.ok(pendingClaims.every((c) => ['Pending', 'Under Review'].includes(c.status) && c.claimId && c.claimant));
  assert.ok(awaitingVerification.every((i) => i.status === 'Pending Verification'));
  assert.ok(flagged.every((i) => ['lost', 'found'].includes(i.type)));
});

test('staff dashboard: counts and work queues with the next action for each claim', async () => {
  const staff = await asStaff();
  const d = (await call('/admin/staff', { token: staff })).data;
  for (const key of ['pendingVerification', 'pendingClaims', 'approvedClaims', 'handoverPending']) assert.equal(typeof d.counts[key], 'number', key);
  assert.ok(d.counts.approvedClaims >= d.counts.handoverPending, 'approved includes completed, handover pending does not');
  assert.ok(Array.isArray(d.claimsNeedingAttention) && Array.isArray(d.awaitingVerification) && Array.isArray(d.activity));
  const actions = ['Review claim', 'Continue review', 'Schedule handover', 'Complete handover'];
  assert.ok(d.claimsNeedingAttention.every((c) => actions.includes(c.nextAction) && ['Pending', 'Under Review', 'Approved'].includes(c.status)));
  assert.ok(d.awaitingVerification.every((i) => i.status === 'Pending Verification' && i.reportId));

  const admin = await asAdmin();
  const overview = (await call('/admin/dashboard', { token: admin })).data;
  assert.equal(d.counts.pendingVerification, overview.pendingVerification, 'both dashboards agree');
  assert.equal(d.counts.pendingClaims, overview.cards.pendingClaims);
});

test('landing statistics are calculated from the database, not hard-coded', async () => {
  const [pub, admin] = [(await call('/public/stats')).data, (await call('/admin/dashboard', { token: await asAdmin() })).data];
  assert.equal(pub.itemsReported, admin.cards.totalReports);
  assert.equal(pub.itemsRecovered, admin.overview.recovery.recovered);
  assert.ok(Math.abs(pub.recoveryRate - admin.cards.successRate) <= 0.5, 'same rate, rounded for display');
  assert.equal(pub.avgMatchConfidence, admin.cards.avgMatchScore);
  assert.ok(pub.activeReports >= 0 && pub.successfulMatches >= 0);

  // creating a report moves the number
  const student = await asStudent();
  const made = (await call('/lost', { token: student, method: 'POST', body: lostPayload() })).data.item;
  assert.equal((await call('/public/stats')).data.itemsReported, pub.itemsReported + 1);
  await call(`/lost/${made._id}`, { token: student, method: 'DELETE' });
  assert.equal((await call('/public/stats')).data.itemsReported, pub.itemsReported);
});

test('matches explain themselves: a factor breakdown that adds up to the score', async () => {
  const student = await asStudent();
  const created = (await call('/lost', {
    token: student, method: 'POST',
    body: lostPayload({ itemName: 'Black Samsung Earbuds', brand: 'Samsung', building: 'Library Block' }),
  })).data;
  const top = created.matches[0];
  assert.ok(top.lost && top.found, 'both sides are included so the card can render');
  for (const m of [top, ...(await call(`/matches/${created.item._id}`, { token: student })).data, ...(await call('/matches', { token: student })).data.slice(0, 3)]) {
    assert.deepEqual(m.breakdown.map((r) => r.key), ['category', 'name', 'color', 'brand', 'location', 'date']);
    assert.equal(Math.round(m.breakdown.reduce((s, r) => s + r.points, 0)), m.score, 'points add up to the score');
    assert.deepEqual(m.matchedFields, m.breakdown.filter((r) => r.matched).map((r) => r.key));
    assert.ok(m.breakdown.every((r) => r.points >= 0 && r.points <= r.max && typeof r.note === 'string'));
    assert.deepEqual(m.breakdown.map((r) => r.max), [25, 20, 15, 15, 15, 10], 'the documented weights');
    const band = m.score >= 80 ? 'High Confidence' : m.score >= 60 ? 'Possible Match' : 'Low Match';
    assert.equal(m.confidence, band);
  }
  await call(`/lost/${created.item._id}`, { token: student, method: 'DELETE' });
});

test('API speaks lostDate/lostTime and foundDate/foundTime; the stored fields stay date/time', async () => {
  const student = await asStudent();
  const payload = lostPayload();
  delete payload.date;
  const lost = (await call('/lost', { token: student, method: 'POST', body: { ...payload, lostDate: '2026-09-30', lostTime: '14:30' } })).data.item;
  assert.equal(lost.lostDate, lost.date);
  assert.match(lost.date, /^2026-09-30/);
  assert.equal(lost.lostTime, '14:30');
  assert.equal(lost.time, '14:30');
  assert.equal(lost.foundDate, undefined, 'a lost report has no foundDate');

  const edited = (await call(`/lost/${lost._id}`, { token: student, method: 'PUT', body: { lostDate: '2026-10-01' } })).data;
  assert.match(edited.lostDate, /^2026-10-01/);

  const found = (await call('/found', { token: student, method: 'POST', body: { ...payload, foundDate: '2026-10-02', foundTime: '09:05' } })).data.item;
  assert.match(found.foundDate, /^2026-10-02/);
  assert.equal(found.foundTime, '09:05');
  assert.equal(found.lostDate, undefined);
  for (const [kind, id] of [['lost', lost._id], ['found', found._id]]) await call(`/${kind}/${id}`, { token: student, method: 'DELETE' });
});

test('claim review shows why the claimed item matched (staff)', async () => {
  const [staff, stranger] = [await asStaff(), await asOtherStudent()];
  const claim = (await call('/admin/claims?status=Pending', { token: staff })).data.items.find((c) => c.matchScore > 0);
  const detail = (await call(`/claims/${claim._id}`, { token: staff })).data;
  assert.ok(detail.matchDetail, 'reviewers get the breakdown');
  assert.equal(detail.matchDetail.breakdown.length, 6);
  assert.ok(detail.claimantHistory, 'and the claimant history');
  assert.equal(detail.foundItemFull.type, 'found');
  assert.equal((await call(`/claims/${claim._id}`, { token: stranger })).status, 403, 'students who are not the claimant cannot open it');
});

test('deleting a found item takes its claims and photo with it (no dangling references)', async () => {
  const [admin, finder, claimant] = [await asAdmin(), await asOtherStudent(), await asStudent()];
  const found = (await call('/found', { token: finder, method: 'POST', form: imageForm(lostPayload({ itemName: `Cascade ${Date.now()}` })) })).data.item;
  const claim = (await call('/claims', { token: claimant, method: 'POST', body: { foundItemId: found._id, lostLocation: 'Library', lostDate: today(), uniqueFeature: 'Scratch on the lid' } })).data;
  assert.equal((await call(`/claims/${claim._id}`, { token: claimant })).status, 200);

  assert.equal((await call(`/found/${found._id}`, { token: claimant, method: 'DELETE' })).status, 403, 'only the reporter or an admin may delete');
  assert.equal((await call(`/found/${found._id}`, { token: finder, method: 'DELETE' })).status, 400, 'a claimed item cannot be withdrawn by the finder');
  assert.equal((await call(`/found/${found._id}`, { token: admin, method: 'DELETE' })).status, 200);
  assert.equal((await call(`/claims/${claim._id}`, { token: claimant })).status, 404, 'its claim is gone');
  assert.ok(!(await call('/claims', { token: claimant })).data.items.some((c) => c._id === claim._id));
  await new Promise((r) => setTimeout(r, 250));
  assert.equal((await fetch(ORIGIN + found.image)).status, 404, 'photo deleted');
});
