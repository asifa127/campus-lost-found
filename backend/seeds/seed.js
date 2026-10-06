// Resets the app collections and loads demo data. Run: npm run seed
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import LostItem from '../models/LostItem.js';
import FoundItem from '../models/FoundItem.js';
import Claim from '../models/Claim.js';
import { Notification, Message, Category, Location, AbuseReport, AuditLog, Counter, Setting, nextId } from '../models/Misc.js';
import { calculateMatchScore } from '../services/matching.js';

const DAY = 86400000;
const ago = (days, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 15, 0, 0);
  return d;
};
const dateOnly = (d) => new Date(d.toISOString().slice(0, 10));

await connectDB();
await Promise.all([User, LostItem, FoundItem, Claim, Notification, Message, Category, Location, AbuseReport, AuditLog, Counter, Setting].map((M) => M.deleteMany({})));
const year = new Date().getFullYear();
await Counter.insertMany([{ _id: `LF-${year}`, seq: 100 }, { _id: `FF-${year}`, seq: 100 }, { _id: `CL-${year}`, seq: 40 }]);

// ---- catalog ----
await Category.insertMany(['Electronics', 'ID Cards', 'Books', 'Accessories', 'Keys', 'Wallets', 'Documents', 'Clothing', 'Other'].map((name) => ({ name })));
await Location.insertMany(['Main Block', 'Library', 'Canteen', 'Computer Lab', 'Mechanical Block', 'ECE Block', 'Parking Area', 'Hostel', 'Auditorium', 'Sports Ground'].map((name) => ({ name })));

// demo values: editable by an admin under Settings
await Setting.create({
  key: 'app', appName: 'Campus Lost & Found', institutionName: 'Campus College',
  contactEmail: 'lostfound@campus.com', supportContact: 'Security Office, Main Block (ground floor)',
});

// ---- users ----
const mk = (name, email, studentId, role, department, year, pw, i) => ({
  name, email, studentId, role, department, year, password: pw, phone: `98765${String(43210 + i).slice(-5)}`,
  createdAt: ago(170 - i * 6),
});
const admin = await User.create(mk('Campus Admin', 'admin@campus.com', 'ADM001', 'admin', 'Administration', 'Staff', 'Admin@123', 0));
const staff = await Promise.all([
  ['Priya Sharma', 'staff@campus.com', 'STF001', 'Security Office'],
  ['Ravi Menon', 'ravi.menon@campus.com', 'STF002', 'Student Affairs'],
  ['Fatima Khan', 'fatima.khan@campus.com', 'STF003', 'Library'],
].map(([n, e, id, dept], i) => User.create(mk(n, e, id, 'staff', dept, 'Staff', 'Staff@123', i + 1))));

const studentRows = [
  ['Arun Kumar', 'student@campus.com', 'CSE'], ['Meera Nair', 'meera.nair@campus.com', 'ECE'], ['Rahul Verma', 'rahul.verma@campus.com', 'Mechanical'],
  ['Sneha Iyer', 'sneha.iyer@campus.com', 'CSE'], ['Karthik Raja', 'karthik.raja@campus.com', 'EEE'], ['Divya Lakshmi', 'divya.lakshmi@campus.com', 'IT'],
  ['Vikram Singh', 'vikram.singh@campus.com', 'Civil'], ['Ananya Das', 'ananya.das@campus.com', 'ECE'], ['Mohammed Faizal', 'mohammed.faizal@campus.com', 'CSE'],
  ['Pooja Reddy', 'pooja.reddy@campus.com', 'IT'], ['Siddharth Rao', 'siddharth.rao@campus.com', 'Mechanical'], ['Lakshmi Priya', 'lakshmi.priya@campus.com', 'EEE'],
  ['Aditya Patel', 'aditya.patel@campus.com', 'CSE'], ['Nisha Thomas', 'nisha.thomas@campus.com', 'Civil'], ['Harish Babu', 'harish.babu@campus.com', 'ECE'],
];
const students = [];
for (const [i, [n, e, dept]] of studentRows.entries()) {
  students.push(await User.create(mk(n, e, `CS21${String(i + 1).padStart(3, '0')}`, 'student', dept, ['1st Year', '2nd Year', '3rd Year', '4th Year'][i % 4], 'Student@123', i + 4)));
}
// one blocked account so the admin filter has something to show
await User.updateOne({ _id: students[14]._id }, { status: 'blocked' });
const arun = students[0];

// ---- found items: [name, category, brand, color, location, building, description, daysAgo, status] ----
const F = [
  ['Black Leather Wallet', 'Wallets', '', 'Black', 'Canteen', 'Main Block', 'Black leather bi-fold wallet found near the billing counter.', 3, 'Claimed'],
  ['Samsung Galaxy Buds Pro', 'Electronics', 'Samsung', 'Black', 'Library', 'Library Block', 'Black wireless earbuds in a charging case, found on a reading table.', 1, 'Verified'],
  ['College ID Card', 'ID Cards', '', 'White', 'Main Block', 'Main Block', 'College ID card on an orange lanyard.', 4, 'Pending Verification'],
  ['Blue Water Bottle', 'Accessories', 'Milton', 'Blue', 'Sports Ground', 'Sports Complex', 'Steel water bottle with a small dent.', 5, 'Recovered'],
  ['HP Laptop Charger', 'Electronics', 'HP', 'Black', 'Computer Lab', 'Main Block', '65W charger with a round pin, left plugged in at a workstation.', 6, 'Claimed'],
  ['Casio Scientific Calculator', 'Electronics', 'Casio', 'Grey', 'Mechanical Block', 'Mechanical Block', 'Casio fx-991 calculator found in a classroom.', 8, 'Recovered'],
  ['USB Pen Drive 32GB', 'Electronics', 'SanDisk', 'Red', 'Computer Lab', 'Main Block', 'Red SanDisk pen drive with a keyring.', 9, 'Claimed'],
  ['Grey Backpack', 'Accessories', 'Wildcraft', 'Grey', 'Parking Area', 'Main Block', 'Grey backpack with laptop compartment.', 10, 'Verified'],
  ['Black Spectacles', 'Accessories', 'Lenskart', 'Black', 'Library', 'Library Block', 'Black rectangular frame spectacles in a hard case.', 12, 'Claimed'],
  ['House Keys with Red Keychain', 'Keys', '', 'Silver', 'Hostel', 'Hostel Block', 'Three keys on a ring with a red keychain.', 13, 'Pending Verification'],
  ['Blue Notebook', 'Books', 'Classmate', 'Blue', 'ECE Block', 'ECE Block', '200-page notebook with circuit diagrams.', 14, 'Claimed'],
  ['Titan Wrist Watch', 'Accessories', 'Titan', 'Brown', 'Auditorium', 'Main Block', 'Analog watch with brown leather strap.', 15, 'Claimed'],
  ['Engineering Mathematics Textbook', 'Books', '', 'Green', 'Library', 'Library Block', 'Textbook with handwritten initials.', 20, 'Recovered'],
  ['Black Umbrella', 'Other', '', 'Black', 'Canteen', 'Main Block', 'Large black folding umbrella.', 35, 'Recovered'],
  ['Grey Hoodie', 'Clothing', 'Puma', 'Grey', 'Auditorium', 'Main Block', 'Grey zip hoodie left on a seat.', 55, 'Recovered'],
  ['boAt Earphones', 'Electronics', 'boAt', 'Red', 'Canteen', 'Main Block', 'Wired red earphones with pouch.', 70, 'Recovered'],
  ['Semester Hall Ticket', 'Documents', '', 'White', 'Main Block', 'Main Block', 'Printed hall ticket in a plastic sleeve.', 95, 'Recovered'],
  ['Brown Leather Wallet', 'Wallets', 'Wildcraft', 'Brown', 'Parking Area', 'Main Block', 'Brown wallet with some cash.', 110, 'Recovered'],
  ['Bike Key with Honda Keychain', 'Keys', 'Honda', 'Black', 'Parking Area', 'Main Block', 'Two-wheeler key with Honda keychain.', 130, 'Recovered'],
  ['Black Jacket', 'Clothing', 'Roadster', 'Black', 'Hostel', 'Hostel Block', 'Black bomber jacket.', 150, 'Recovered'],
];
const finderPool = [students[10], students[11], students[12], students[13], staff[0], staff[1]];
const found = [];
for (const [i, [itemName, category, brand, color, location, building, description, days, status]] of F.entries()) {
  const finder = finderPool[i % finderPool.length];
  found.push(await FoundItem.create({
    reportId: await nextId('FF'), userId: finder._id, itemName, category, brand, color, location, building, description, status,
    date: dateOnly(ago(days)), time: '14:30', floor: 'Ground', currentLocation: 'Security Office', foundBy: finder.name,
    verifiedBy: status === 'Pending Verification' ? undefined : staff[0]._id,
    verifiedAt: status === 'Pending Verification' ? undefined : ago(days - 0.5),
    createdAt: ago(days, 15), updatedAt: ago(days, 15),
  }));
}

// ---- lost items: [name, category, brand, color, location, building, description, unique feature, daysAgo, ownerIdx, status] ----
const L = [
  ['Black Wallet', 'Wallets', '', 'Black', 'Canteen', 'Main Block', 'Black leather wallet with a few cards inside.', 'Photo of a dog inside the flap', 4, 0, 'Claimed'],
  ['Blue Water Bottle', 'Accessories', 'Milton', 'Blue', 'Sports Ground', 'Sports Complex', 'Blue steel bottle.', 'Dent near the bottom', 6, 0, 'Recovered'],
  ['College ID Card', 'ID Cards', '', 'White', 'Main Block', 'Main Block', 'College ID with lanyard.', 'Lanyard is orange', 5, 0, 'Matched'],
  ['HP Laptop Charger', 'Electronics', 'HP', 'Black', 'Computer Lab', 'Main Block', '65W charger.', 'Black tape near the plug', 7, 1, 'Claimed'],
  ['Casio Calculator', 'Electronics', 'Casio', 'Grey', 'Mechanical Block', 'Mechanical Block', 'Casio fx-991 scientific calculator.', 'Name written on back cover', 9, 2, 'Recovered'],
  ['USB Drive', 'Electronics', 'SanDisk', 'Red', 'Computer Lab', 'Main Block', '32GB red pen drive.', 'Label "RV" on the casing', 10, 3, 'Claimed'],
  ['Grey Backpack', 'Accessories', 'Wildcraft', 'Grey', 'Parking Area', 'Main Block', 'Grey backpack with laptop compartment.', 'Panda keychain on the zip', 11, 4, 'Matched'],
  ['Spectacles', 'Accessories', 'Lenskart', 'Black', 'Library', 'Library Block', 'Black frame spectacles.', 'Right hinge repaired with glue', 13, 5, 'Claimed'],
  ['House Keys', 'Keys', '', 'Silver', 'Hostel', 'Hostel Block', 'Set of three keys on a ring.', 'Red keychain with letter S', 14, 6, 'Matched'],
  ['Blue Notebook', 'Books', 'Classmate', 'Blue', 'ECE Block', 'ECE Block', '200-page notebook.', 'Name sticker on cover', 15, 7, 'Claimed'],
  ['Titan Watch', 'Accessories', 'Titan', 'Brown', 'Auditorium', 'Main Block', 'Brown leather strap watch.', 'Engraving on the back', 16, 8, 'Claimed'],
  ['Mathematics Textbook', 'Books', '', 'Green', 'Library', 'Library Block', 'Engineering Mathematics textbook.', 'Initials on first page', 21, 9, 'Recovered'],
  ['Black Umbrella', 'Other', '', 'Black', 'Canteen', 'Main Block', 'Folding umbrella.', 'Broken second rib', 36, 1, 'Recovered'],
  ['Grey Hoodie', 'Clothing', 'Puma', 'Grey', 'Auditorium', 'Main Block', 'Grey zip hoodie.', 'Torn pocket', 56, 2, 'Recovered'],
  ['Red Earphones', 'Electronics', 'boAt', 'Red', 'Canteen', 'Main Block', 'Red wired earphones.', 'Left bud has a sticker', 71, 3, 'Recovered'],
  ['Hall Ticket', 'Documents', '', 'White', 'Main Block', 'Main Block', 'Semester hall ticket.', 'Register number ends in 417', 96, 4, 'Recovered'],
  ['Brown Wallet', 'Wallets', 'Wildcraft', 'Brown', 'Parking Area', 'Main Block', 'Brown leather wallet.', 'Initials stitched inside', 111, 5, 'Recovered'],
  ['Bike Key', 'Keys', 'Honda', 'Black', 'Parking Area', 'Main Block', 'Honda two-wheeler key.', 'Rubber cover cracked', 131, 6, 'Recovered'],
  ['Black Jacket', 'Clothing', 'Roadster', 'Black', 'Hostel', 'Hostel Block', 'Black bomber jacket.', 'Name tag inside collar', 151, 7, 'Recovered'],
  ['Realme Mobile Phone', 'Electronics', 'Realme', 'Blue', 'Canteen', 'Main Block', 'Blue Realme phone with cracked back.', 'Lock-screen is a cricket photo', 2, 11, 'Submitted'],
  ['Folding Umbrella', 'Other', '', 'Blue', 'Parking Area', 'Main Block', 'Blue folding umbrella.', 'Wooden handle', 1, 0, 'Draft'],
];
const lost = [];
for (const [itemName, category, brand, color, location, building, description, uniqueFeatures, days, owner, status] of L) {
  lost.push(await LostItem.create({
    reportId: await nextId('LF'), userId: students[owner]._id, itemName, category, brand, color, location, building, description, uniqueFeatures,
    status, date: dateOnly(ago(days)), time: '11:00', floor: '1', estimatedValue: 500,
    createdAt: ago(days - 0.2), updatedAt: ago(days - 0.2),
    flagged: itemName === 'Realme Mobile Phone',
  }));
}

// ---- claims: [lostIdx, foundIdx, status] ----
const C = [
  [0, 0, 'Pending'], [1, 3, 'Completed'], [3, 4, 'Under Review'], [4, 5, 'Completed'], [5, 6, 'Pending'], [6, 7, 'Rejected'],
  [7, 8, 'Approved'], [8, 9, 'Cancelled'], [9, 10, 'Approved'], [10, 11, 'Pending'],
  ...[11, 12, 13, 14, 15, 16, 17, 18].map((i) => [i, i + 1, 'Completed']),
];
const step = (label, note, by, at) => ({ label, note, by, at });
for (const [li, fi, status] of C) {
  const l = lost[li];
  const f = found[fi];
  const created = new Date(Math.max(f.createdAt.getTime() + 6 * 3600e3, Date.now() - 400 * DAY));
  const resolved = new Date(Math.min(created.getTime() + 1.5 * DAY, Date.now() - 3600e3));
  const reviewer = staff[li % 2];
  const done = ['Approved', 'Completed', 'Rejected'].includes(status);
  const timeline = [step('Claim Submitted', 'Claim submitted for review', l.userId, created)];
  if (status !== 'Pending') timeline.push(step('Under Review', '', reviewer._id, new Date(created.getTime() + 3600e3)));
  if (status === 'Cancelled') timeline.push(step('Cancelled by claimant', '', l.userId, resolved));
  if (status === 'Rejected') timeline.push(step('Rejected', 'Identifying details did not match', reviewer._id, resolved));
  if (['Approved', 'Completed'].includes(status)) timeline.push(step('Approved', 'Details verified against the report', reviewer._id, resolved));
  let handover;
  if (li === 7) {
    handover = { status: 'Scheduled', date: new Date(Date.now() + DAY), location: 'Security Office', verifiedBy: reviewer._id };
    timeline.push(step('Handover scheduled', 'Security Office', reviewer._id, resolved));
  }
  if (status === 'Completed') {
    handover = { status: 'Completed', date: resolved, location: 'Security Office', verifiedBy: reviewer._id, receiverConfirmed: true, completedAt: new Date(resolved.getTime() + 3600e3) };
    timeline.push(step('Handover completed', 'Item successfully recovered', reviewer._id, handover.completedAt));
  }
  const claimant = students[L[li][9]];
  await Claim.create({
    claimId: await nextId('CL'), foundItem: f._id, lostItem: l._id, claimant: claimant._id,
    answers: { lostLocation: l.location, lostDate: l.date, uniqueFeature: L[li][7], additional: 'I can describe the contents if needed.' },
    matchScore: calculateMatchScore(l, f).score, status, handover,
    reviewedBy: status === 'Pending' ? undefined : reviewer._id,
    reviewComments: done ? timeline.at(-1).note : undefined,
    resolvedAt: done ? resolved : undefined, timeline, createdAt: created, updatedAt: handover?.completedAt || resolved,
  });
  await FoundItem.updateOne({ _id: f._id }, { uniqueFeatures: L[li][7] }); // private detail only staff and the finder see
  await AuditLog.create({ user: claimant._id, action: 'CREATE_CLAIM', target: f.reportId, createdAt: created });
  if (done) await AuditLog.create({ user: reviewer._id, action: status === 'Rejected' ? 'CLAIM_REJECT' : 'CLAIM_APPROVE', target: f.reportId, createdAt: resolved });
}

await FoundItem.updateOne({ _id: found[1]._id }, { uniqueFeatures: 'Scratch on the case lid and a blue sticker inside the case' });

// ---- audit trail, abuse report, notifications, messages ----
for (const f of found.slice(0, 12)) await AuditLog.create({ user: f.userId, action: 'CREATE_FOUND_REPORT', target: f.reportId, details: f.itemName, createdAt: f.createdAt });
for (const l of lost.slice(0, 12)) await AuditLog.create({ user: l.userId, action: 'CREATE_LOST_REPORT', target: l.reportId, details: l.itemName, createdAt: l.createdAt });
await AuditLog.create({ user: admin._id, action: 'BLOCK_USER', target: students[14].email, createdAt: ago(8) });
await AbuseReport.create({
  itemType: 'lost', itemId: lost[19]._id, reportId: lost[19].reportId, itemName: lost[19].itemName,
  reporter: students[2]._id, reason: 'Wrong information', details: 'Photo does not match the description.', createdAt: ago(1),
});

const notes = [
  [arun, 'Possible match found', 'Possible match found for your lost wallet (81% - Black Leather Wallet).', 'match', `/items/found/${found[0]._id}`, 3, false],
  [arun, 'Claim submitted', 'Your claim for "Black Leather Wallet" is pending review.', 'claim', '/my-claims', 2, false],
  [arun, 'Possible match found', 'A found item "College ID Card" matches your lost college id card.', 'match', `/items/found/${found[2]._id}`, 4, false],
  [arun, 'Claim approved', 'Your claim for "Blue Water Bottle" has been approved.', 'claim', '/my-claims', 4, true],
  [arun, 'Item recovered', 'Item Successfully Recovered 🎉', 'handover', '/my-claims', 3, true],
  [arun, 'Your report was verified', 'Your lost report for Blue Water Bottle was verified by campus staff.', 'report', '/my-reports', 5, true],
  [students[1], 'Your claim requires additional information', 'Please describe the brand of your charger.', 'claim', '/my-claims', 2, false],
  [students[3], 'Claim submitted', 'Your claim for "USB Pen Drive 32GB" is pending review.', 'claim', '/my-claims', 8, true],
  [students[10], 'Your found item has been claimed', '"Blue Water Bottle" was returned to its owner. Thank you!', 'claim', '/my-reports', 3, false],
  [staff[0], 'New claim to review', 'Arun Kumar claimed "Black Leather Wallet".', 'claim', '/admin/claims', 2, false],
  [staff[0], 'New found item', 'College ID Card needs verification.', 'report', '/admin/reports', 4, false],
  [admin, 'Item flagged', 'A lost report was reported: Wrong information', 'system', '/admin/abuse', 1, false],
];
for (const [u, title, message, type, link, days, read] of notes) await Notification.create({ userId: u._id, title, message, type, link, read, createdAt: ago(days) });

await Message.insertMany([
  { from: students[11]._id, to: arun._id, text: 'Hi Arun, I think I found your wallet near the canteen counter. It is at the Security Office now.', read: true, createdAt: ago(3, 16), itemRef: { itemType: 'found', itemId: found[0]._id, reportId: found[0].reportId, itemName: found[0].itemName } },
  { from: arun._id, to: students[11]._id, text: 'Thank you so much! I will submit a claim right away.', read: true, createdAt: ago(3, 17) },
  { from: staff[0]._id, to: arun._id, text: 'Your claim is under review. Please bring your college ID when you visit the Security Office.', read: false, createdAt: ago(1, 11) },
]);

const counts = await Promise.all([User, LostItem, FoundItem, Claim, Notification].map((M) => M.countDocuments()));
console.log(`Seeded: ${counts[0]} users, ${counts[1]} lost, ${counts[2]} found, ${counts[3]} claims, ${counts[4]} notifications`);
await mongoose.disconnect();
