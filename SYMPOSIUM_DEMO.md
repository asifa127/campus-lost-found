# Symposium Demo Script

Before each run: `npm run seed --prefix backend` (the demo changes the data, the seed puts it back).
Open http://localhost:5173. The API runs on http://localhost:5000.

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Student | student@campus.com  | Student@123 |
| Staff   | staff@campus.com    | Staff@123   |
| Admin   | admin@campus.com    | Admin@123   |

## Demo 1: Student reports a lost item

1. Log in as the student. (From the home page, **Report Lost Item** asks you to log in and then opens the form.)
2. Report a lost item:
   - Item name: **Black Samsung Earbuds**, Category: Electronics, Color: Black, Brand: Samsung
   - Location: **Library**, any short description
3. Submit. The success screen shows **Potential Match — 91%** with **HIGH CONFIDENCE** and the checks
   Same Category, Similar Item Name, Same Color, Same Brand, Same Location, Close Dates.
4. Say: "The system compares important attributes between lost and found reports."
5. Open **Why this matched** to show the points: Category +25, Name similarity +11.4, Color +15, Brand +15,
   Location +15, Date +10 = 91 / 100. It is the Smart Matching Algorithm, a transparent rule-based score, not AI.

## Demo 2: Claim verification

1. On the success screen click **Open match & claim**, then **Claim This Item**.
2. Fill in where and when it was lost and a unique identifying feature, then **Submit Claim**. The claim shows as Pending in My Claims.
3. Log out, log in as **staff**. The Staff Dashboard lists the new claim under Claims Requiring Attention.
4. Click **Review claim**. Show the verification details: **Why this item matched**, the claimant's answers and the finder's private details.
5. **Start review**, then **Approve** (add a note) and confirm with **Approve claim**.

## Demo 3: Recovery

1. After approval the item is still **Claimed**. It is not Recovered yet.
2. Under **Item handover** enter a date and location, then **Schedule handover**.
3. Tick the receiver confirmation and click **Mark handover complete**.
4. Show: the claim says **Item Successfully Recovered**, and the item status is now **Recovered**.
5. Log in as the student: Notifications has **Item recovered**, and My Reports shows the lost report as Recovered.

## Demo 4: Admin analytics

1. Log in as **admin**. The dashboard shows Total Users, Lost Items, Found Items, Recovered Items, Pending Claims and Recovery Rate.
2. Compared with before Demo 1: Lost Items +1 and Recovered Items +1, and the Recovery Rate has moved.
3. Scroll to the charts: Lost vs Found, Items by category, Items by location, Monthly recovery trend, Claim status.
4. Try **Today / This week / This month**. Explain that every number is calculated from MongoDB when the page loads,
   so it changes as soon as a report, claim or handover changes.

## Architecture

```
User -> React (Vite) -> Express REST API -> Auth middleware -> Controllers / Services -> MongoDB

Lost Item -> Matching Service -> Found Items -> Match Score -> Claim -> Verification -> Handover -> Recovered
```
