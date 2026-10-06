# 🎓 Campus Lost & Found

A full-stack web app where students report lost and found belongings, a **smart matching algorithm** pairs them automatically, and staff verify ownership and hand items back.

## Problem statement

Students often lose valuable belongings on campus, while found items are difficult to connect with their owners. Notice boards and WhatsApp groups are scattered, unsearchable and unverified.

## Solution

One central platform: report lost/found items with photos, get automatic match suggestions with a confidence score, claim an item, have staff verify the claim, and track the handover to the final "Recovered" status.

## Features

| Area | What works |
|---|---|
| Auth | Register (validation, duplicate email/ID checks), login + remember me, logout, forgot/reset password, role-based redirects, protected routes |
| Reports | Report lost / found with image upload, report IDs (`LF-2026-00123`, `FF-2026-00123`), drafts, edit, delete |
| Browse | Tabs (All / Lost / Found / Recovered), debounced search, filters (category, color, location, building, status, date range), sorting (newest, oldest, relevance, highest match), pagination, URL-shareable filters |
| Smart matching | Score out of 100, matched-field list, confidence levels, automatic matching on every new report, `/matches` page, match alerts |
| Claims | Claim form with proof image, staff review (approve / reject / request more info), claimant response, cancel, status timeline |
| Handover | Schedule handover, receiver confirmation, claim → Recovered, "Item Successfully Recovered 🎉" |
| Notifications | Unread badge, mark read / mark all read, per-type preferences |
| Messages | Reporter ↔ student conversations without exposing phone/email, unread and read receipts |
| Profile | Edit profile + photo, change password, notification preferences, saved items |
| Admin | Dashboard + 5 Recharts charts with trend indicators, users (filter, edit, block/unblock, delete), reports (verify, flag, change status, edit, delete), claims, categories & locations CRUD, analytics, audit logs, abuse report review |
| Staff | Staff dashboard, verify reports, review claims, manage handovers |
| Security | bcrypt hashing, JWT, role checks on the **server** (role is read from the DB on every request), input validation, rate limiting, helmet, upload type/size validation, no passwords in responses, private details hidden from public item views |
| UX | Responsive (desktop sidebar → mobile drawer + bottom nav), sticky filter column that becomes a bottom sheet on phones, skeleton loaders, empty/error/retry states, toasts, confirmation dialogs, keyboard focus states, ARIA labels, reduced-motion support |

## Technology stack

**Frontend:** React 19, Vite, Tailwind CSS 4, React Router, React Hook Form, Lucide icons, Recharts, Geist font (self-hosted, so it works offline)
**Backend:** Node.js, Express 5, Mongoose
**Database:** MongoDB
**Auth/Security:** JWT, bcryptjs, helmet, express-rate-limit, multer (validated uploads)

## Architecture

```
React (Vite, :5173) ──/api, /uploads (dev proxy)──▶ Express (:5000) ──▶ MongoDB
```

```
campus-lost-found/
├─ frontend/src/
│  ├─ components/   ui.jsx (Button, Input, Modal, Table, Tabs, Timeline, StatCard…), ItemCard, MatchCard, ItemForm, ClaimModal, Charts
│  ├─ pages/        public + student pages, pages/admin/*
│  ├─ layouts/      AppLayout (sidebar, topbar, drawer, bottom nav, global search)
│  ├─ context/      AuthContext, ToastContext
│  ├─ hooks/        useFetch, useDebounce, useCatalog
│  ├─ services/     api.js (fetch wrapper, token handling)
│  └─ utils/        format.js (dates, status colors, constants)
├─ backend/
│  ├─ config/       env.js, db.js
│  ├─ models/       User, LostItem, FoundItem, Claim, Misc (Notification, Message, Category, Location, AbuseReport, AuditLog, Counter)
│  ├─ controllers/  auth, item (lost/found factory), browse, match, claim, social, admin
│  ├─ routes/       index.js (all routes + role guards)
│  ├─ middleware/   auth (protect / authorize), upload, error
│  ├─ services/     matching.js, itemService.js, notify.js
│  ├─ seeds/        seed.js
│  └─ tests/        end-to-end API tests
├─ .env.example
└─ package.json     (root scripts)
```

## Design language

The UI follows a restrained, shadcn-style system (modelled on the Hirael e-commerce category page): neutral tokens, hairline borders, small radii and no decorative gradients.

- **Tokens** live in `frontend/src/index.css` (oklch neutrals in one cool-zinc family, a near-black primary, hairline `--border`). Colour appears only as data: status dots, trend text and the Lost/Found chart pair.
- **Components** are in `frontend/src/components/ui.jsx`: outline badges with status dots, underline tabs, divided stat grid, 15rem title rail for forms, borderless item cards with a framed 4:5 image, bottom-sheet dialogs on phones.
- **Typography:** Geist (and Geist Mono for report IDs), `tabular-nums` for figures, uppercase micro-labels for table heads, filter groups and stat captions.
- **Motion:** one eased entrance (`enter` / `swap` utilities, staggered with `animation-delay`), transform and opacity only, disabled under `prefers-reduced-motion`.
- **Charts** use a palette checked with the data-viz validator (Lost = orange `#eb6834`, Found = blue `#2a78d6`; CVD and contrast checks pass on white), thin bars with rounded ends, solid hairline grids, tooltips with the value first, and a hidden data table behind every chart for screen readers.

## Database design

| Model | Key fields |
|---|---|
| **User** | name, email (unique), password (hashed, never returned), role (`student`/`staff`/`admin`), studentId (unique), phone, department, year, status (`active`/`blocked`), profileImage, notificationPrefs, savedItems |
| **LostItem** | reportId, userId, itemName, category, description, brand, color, model, uniqueFeatures, date, time, location, building, floor, image, status, flagged, estimatedValue, reward |
| **FoundItem** | same fields + currentLocation, foundBy; status starts at `Pending Verification` |
| **Claim** | claimId, foundItem, lostItem, claimant, answers, evidence, matchScore, status, reviewedBy, reviewComments, handover {status, date, location, verifiedBy, receiverConfirmed}, timeline[] |
| **Notification** | userId, title, message, type, link, read, createdAt |
| **Message** | from, to, text, itemRef, read, createdAt |
| **Category / Location** | name, enabled |
| **AbuseReport** | itemType, itemId, reporter, reason, details, status (this is the "Report" model from the brief, renamed to avoid clashing with lost/found reports) |
| **AuditLog** | user, action, target, details, createdAt |

> Note: both item models store the event moment in `date`/`time` (instead of `lostDate`/`foundDate`) so one matching routine and one controller factory serve both.

## API

Every response is `{ success: true, data }` or `{ success: false, message }`.

| Module | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · `PUT /api/auth/profile` · `PUT /api/auth/password` |
| Lost | `POST /api/lost` · `GET /api/lost` · `GET/PUT/DELETE /api/lost/:id` |
| Found | `POST /api/found` · `GET /api/found` · `GET/PUT/DELETE /api/found/:id` |
| Browse / search | `GET /api/items` (unified, filtered) · `GET /api/search?q=` · `GET /api/dashboard` · `GET /api/catalog` |
| Matches | `GET /api/matches` (all mine) · `GET /api/matches/:lostItemId` |
| Claims | `POST /api/claims` · `GET /api/claims` · `GET /api/claims/:id` · `PUT /api/claims/:id` (`approve`, `reject`, `request_info`, `under_review`, `cancel`, `respond`) · `PUT /api/claims/:id/handover` |
| Notifications | `GET /api/notifications` · `PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all` |
| Messages | `GET /api/messages` · `GET /api/messages?with=<userId>` · `POST /api/messages` |
| Abuse | `POST /api/abuse` |
| Staff + Admin | `GET /api/admin/dashboard` · `GET /api/admin/reports` · `GET /api/admin/claims` · `PUT /api/admin/reports/:type/:id/verify` · `…/flag` |
| Admin only | `GET /api/admin/analytics` · `GET /api/admin/users` (+ `GET/PUT/DELETE /:id`, `PUT /:id/block`, `/unblock`) · `PUT /api/admin/reports/:type/:id/status` · `GET /api/admin/audit` · `GET/PUT /api/admin/abuse` · `POST/PUT/DELETE /api/admin/categories`, `/locations` |

## How the Smart Matching Algorithm Works

`backend/services/matching.js` → `calculateMatchScore(lostItem, foundItem)` returns `{ score, matchedFields, confidence }`.

| Factor | Points | How it is scored |
|---|---|---|
| Category | 25 | Same category (case-insensitive) |
| Item name | 20 | Word overlap (Dice coefficient) after lower-casing, removing filler words and mapping synonyms (`buds`/`earbuds`/`earphones`, `spectacles`/`glasses`, `pendrive`/`usb` …). `20 × similarity` |
| Color | 15 | Any shared color word |
| Brand | 15 | Equal, or one contains the other |
| Location | 15 | Same campus location (8 if only the building matches) |
| Date | 10 | Within 1 day: 10 · 3 days: 8 · 7 days: 5 · 14 days: 2 · otherwise 0 |

**Confidence:** 80-100 **High Match** · 60-79 **Possible Match** · 40-59 **Low Match** · below 40 is never shown.

**Example:** lost *"Black Samsung Earbuds"* (Library) vs found *"Samsung Galaxy Buds Pro"* (Library, black, 1 day apart): category 25 + name 11.4 + color 15 + brand 15 + location 15 + date 10 = **91% - High Match**.

Matching runs automatically: a new **lost** report is scored against all open found reports (the result is shown immediately and the owner is notified for 60%+), and a new **found** report notifies owners of matching lost reports.

## Installation

Requirements: Node.js 20+, MongoDB running locally (or an Atlas URI).

```bash
# 1. install everything (root + backend + frontend)
npm run install:all

# 2. configure environment
cp .env.example .env        # then set JWT_SECRET to a long random string

# 3. load demo data (resets the app collections)
npm run seed

# 4. run frontend + backend together
npm run dev
```

Open **http://localhost:5173**. The API runs on http://localhost:5000.

Run separately if you prefer: `npm run backend` and `npm run frontend`.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/campus-lost-found` |
| `JWT_SECRET` | Secret for signing tokens (required) | - |
| `PORT` | API port | `5000` |
| `CLIENT_URL` | Allowed frontend origin (CORS) | `http://localhost:5173` |

### Tests

With the API running on a freshly seeded database:

```bash
npm test --prefix backend
```

These tests change data (claims get approved), so run `npm run seed` again before a live demo.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@campus.com` | `Admin@123` |
| Student (Arun Kumar) | `student@campus.com` | `Student@123` |
| Staff (Priya Sharma) | `staff@campus.com` | `Staff@123` |

All other seeded students use `Student@123`. The login page also has one-click demo buttons.

Seed data: 15 students (one blocked), 3 staff, 1 admin, 21 lost reports (incl. 1 draft), 20 found reports, 18 claims across every status, notifications, messages, an open abuse report and an audit trail spread over ~5 months so charts are populated.

## Symposium demo flow (≈3 minutes)

1. Log in as **Student** (`student@campus.com`).
2. **Report Lost** → *Black Samsung Earbuds*, category Electronics, color Black, brand Samsung, location **Library** → Submit.
3. The success screen shows the report ID and **"Potential Match Found - 91%"**.
4. **Open match & claim** → **Claim This Item** → fill the answers → Submit. Status: *Pending*.
5. Log out. Log in as **Staff** (`staff@campus.com`) → *Review Claims* → open the claim.
6. Compare the claimant's answers with the finder's private details → **Approve**. The item becomes **Recovered**.
7. Schedule the handover, tick receiver confirmation, **Mark handover complete** → "Item Successfully Recovered 🎉".
8. Log in as **Admin** → dashboard: recovered count, recovery rate and charts have all updated. Show Users, Reports, Audit Logs.
9. Log back in as the Student → Notifications shows "Your claim has been approved".

Re-run `npm run seed` to reset before the next demo.

## Symposium explanation

- **Problem:** Students often lose valuable belongings on campus, while found items are difficult to connect with their owners.
- **Solution:** A centralized digital platform to report lost/found items and automatically identify potential matches.
- **Innovation:** Smart matching algorithm.
- **Technology:** React, Node.js, Express, MongoDB, JWT, Tailwind CSS.
- **Future scope:** AI image recognition · Face/ID verification · Mobile application · Push notifications · GPS-based location matching · College ERP integration · Email/SMS notifications.

## Screenshots

_Add screenshots here: landing page, student dashboard, match result, claim review, admin dashboard._

## Known limitations

- **Email is mocked.** There is no SMTP server: password-reset links are printed in the API console and, outside production, shown on the "Forgot password" screen. `services/notify.js` is where a Nodemailer call would go.
- **Images are stored on local disk** (`backend/uploads`), not Cloudinary. Swapping needs only `middleware/upload.js`.
- **Self-registered "staff" accounts become students** until an admin changes their role (privilege escalation guard).
- **Admin "Settings" page is not built**; that sidebar slot is used for *Abuse Reports*.
- **Landing footer links** (About, Contact, Privacy, Terms) jump back to the page content; there are no separate pages for them yet.
- **Light theme only.** The tokens are semantic, so a dark theme is a matter of adding a second set of values.
- **Browse merges lost + found in memory** (fine for a campus-sized dataset, see the `ponytail:` note in `browseController.js`).
- **Messaging polls every 8 s**, no websockets.
- Matching is a rule-based heuristic (no image or semantic matching).
- Not tested in Safari/Firefox, and no automated UI tests; the backend has API tests only.

## Future enhancements

AI image similarity, ID-card OCR, push/email/SMS notifications, GPS or map-based location matching, websockets for chat, ERP/single sign-on integration, Cloudinary storage.
