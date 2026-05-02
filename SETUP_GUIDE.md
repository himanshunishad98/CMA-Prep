# CMAPrep Pro — Authentication Setup Guide

## Overview
Three files are involved:
| File | Purpose |
|---|---|
| `index.html` | Updated frontend with real auth logic |
| `Code.gs` | Google Apps Script backend (register + login) |
| `dashboard-auth.html` | Session guard + logout for dashboard.html |

---

## Step 1 — Prepare Your Google Sheet

1. Open your sheet: https://docs.google.com/spreadsheets/d/1aSgbweZ1BzXXmO0GQfHKlXJhZynUGePjT-G77YlKN0I
2. Make sure the tab is named exactly: **Students**
3. Add these headers in **Row 1** (columns A–I):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Full Name | CMA Registration Number | Email | Mobile | City | Level | Password | Photo URL | Registration Date |

> If rows already exist, data will start from Row 2.

---

## Step 2 — Create the Apps Script Project

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing `Code.gs` content
3. Copy the entire content of `Code.gs` and paste it
4. Click **Save** (💾 icon or Ctrl+S)
5. Name the project: `CMAPrep Auth`

---

## Step 3 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙ next to "Select type" → choose **Web app**
3. Fill in:
   - **Description:** `CMAPrep Auth v1`
   - **Execute as:** `Me (your Google account)`
   - **Who has access:** `Anyone`  ← important!
4. Click **Deploy**
5. **Authorize** the app when prompted (click "Review permissions" → choose your account → "Allow")
6. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## Step 4 — Connect the Frontend

1. Open `index.html`
2. Find this line near the bottom:
   ```js
   const GAS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your copied Web App URL:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. Save the file

---

## Step 5 — Add Dashboard Protection

1. Open `dashboard.html`
2. Inside `<head>`, paste the entire contents of `dashboard-auth.html`
   (the `<script>` block at the top)
3. Add a logout button anywhere in your dashboard toolbar:
   ```html
   <button class="btn btn-outline btn-sm" onclick="logout()">Logout</button>
   ```
4. Optional — show the user's name in the dashboard:
   ```html
   <span id="dash-user-name">Loading...</span>
   ```
   The script will auto-fill this from the session.

---

## Step 6 — Test the Flow

### Register:
1. Open `index.html` → click **Register Free**
2. Fill all fields and submit
3. Check your Google Sheet — a new row should appear
4. You should be redirected to `dashboard.html`

### Login:
1. Go to `index.html` → click **Login**
2. Enter Email (or CMA Reg No.) + Password
3. On success → redirected to `dashboard.html`

### Logout:
1. Click the Logout button on dashboard
2. Session is cleared → redirected to `index.html`

### Dashboard protection:
1. Clear your browser's localStorage
2. Try opening `dashboard.html` directly
3. Should redirect back to `index.html`

---

## Re-deploying After Changes

If you update `Code.gs`, you **must** create a new deployment:
1. **Deploy → Manage deployments**
2. Click the pencil ✏ on your existing deployment
3. Change version to **"New version"**
4. Click **Deploy**
5. The URL stays the same — no frontend change needed

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Network error" in toast | Check GAS_URL is correct in index.html |
| Sheet not updating | Make sure "Who has access" = **Anyone** in deployment |
| "Account already exists" on first register | Clear Row 2+ of sheet and retry |
| Dashboard doesn't redirect | Make sure dashboard-auth.html script is inside `<head>` |
| Login always fails | Check Password column (G) in sheet has plain text passwords |

---

## Security Notes

- Passwords are stored as plain text in the sheet for simplicity.  
  For production, consider hashing passwords server-side using `Utilities.computeDigest()` in Apps Script.
- The Google Sheet should only be accessible to the sheet owner.
- Apps Script "Execute as: Me" means it runs with your permissions — users never see the sheet directly.
