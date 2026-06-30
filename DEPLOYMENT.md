# Deployment Guide — SFC-G Supply Management

## Architecture

```
Browser (User)
    │
    ├── https://your-vercel-app.vercel.app  (Frontend — React SPA)
    │     │
    │     └── api() calls → https://your-awardspace.com/api/*.php
    │
    └── Awardspace Shared Hosting  (Backend — PHP + MySQL)
          ├── api/*.php
          ├── api/config/*.php
          └── .env
```

---

## Step 1: Awardspace — Database Setup

### 1a. Create MySQL Database
1. Log in to **Awardspace cPanel**
2. Go to **MySQL Databases**
3. Create a new database (e.g., `youruser_supply`)
4. Create a database user with a strong password
5. Add the user to the database with **ALL PRIVILEGES**
6. Note the **hostname** (usually `localhost`, but Awardspace may use `mysqlXX.awardspace.net`)

### 1b. Import the SQL Dump
1. Open **phpMyAdmin** in cPanel
2. Select your new database
3. Click **Import** → Choose file → select `supply_management (v.1).sql`
4. Click **Go** — wait for import to complete

---

## Step 2: Awardspace — Backend Files

### 2a. Prepare `.env` for Production
Copy this to your Awardspace server as `public_html/.env`:

```ini
VITE_API_BASE_URL=https://your-vercel-app.vercel.app
VITE_RECAPTCHA_SITE_KEY=6LdFDqgsAAAAAINqbtrMA1A6oJhRyt6vmNg8tPjp
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://127.0.0.1:5173,http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_NAME=youruser_supply
DB_USER=youruser_dbuser
DB_PASS=your_strong_password

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=7e010a001@smtp-brevo.com
SMTP_PASSWORD=@Jbkenthrina25
SMTP_FROM_NAME=SFCG
SMTP_FROM_EMAIL=sfcginquiry@gmail.com
SMTP_API_KEY=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
SMTP_ENCRYPTION=auto
SMTP_TIMEOUT=20
SMTP_VERIFY_PEER=false
SMTP_VERIFY_PEER_NAME=false
```

> ⚠️ **File location matters!** The PHP `env.php` looks for `.env` using `dirname(__DIR__, 2)` from `api/config/env.php`. If `api/` is at `public_html/api/`, then `.env` goes in **`public_html/.env`**.

### 2b. Upload Files via FTP/cPanel
Upload the entire `api/` folder to `public_html/api/` on Awardspace:

| File | Status |
|------|--------|
| `api/config/cors.php` | **NEW** — CORS handling |
| `api/config/admin_inventory.php` | **UPDATED** — now delegates to cors.php |
| `api/*.php` (all root files) | **UPDATED** — CORS centralized |
| `api/config/*.php` (rest) | Unchanged |

### 2c. Verify Backend
Visit in your browser:
```
https://your-awardspace.com/api/public-supplies.php
```

Expected: A JSON response (not a blank page or error). If you see an error, check the `.env` database credentials.

---

## Step 3: Vercel — Frontend

### 3a. Set Production API URL
In your local `.env` file (project root), set:
```ini
VITE_API_BASE_URL=https://your-awardspace.com
```

> `VITE_API_BASE_URL` is read at **build time** by Vite. If empty, API calls go to the same domain as the frontend.

### 3b. Build
```bash
npm install
npm run build
```

This produces the `dist/` folder.

### 3c. Deploy to Vercel

**Option A — Vercel CLI:**
```bash
npm i -g vercel
vercel --prod
```

**Option B — GitHub Integration (recommended):**
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repository
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Environment Variables:
   - `VITE_API_BASE_URL` = `https://your-awardspace.com`
7. Deploy

---

## Step 4: How CORS Works Now

The `api/config/cors.php` function checks `ALLOWED_ORIGINS` from `.env`:

```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173
```

- If the browser's `Origin` matches the list → server responds with `Access-Control-Allow-Origin: <origin>`
- If `*` is in the list → any origin accepted (insecure, not recommended)
- If no `ALLOWED_ORIGINS` set → falls back to localhost origins for dev

You can add multiple origins separated by commas.

---

## Step 5: How API Calls Work Now

The frontend no longer calls `fetch("/api/...")` directly. Instead it uses:

```ts
// src/lib/api.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export function api(input: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${input}`, {
    ...init,
    credentials: 'include',
  })
}
```

In **development**: `VITE_API_BASE_URL` is empty → calls go to Vite's dev server → proxied to `http://localhost/api/`

In **production**: `VITE_API_BASE_URL` is `https://your-awardspace.com` → calls go directly to Awardspace

---

## Quick Reference

```bash
# Local dev
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy frontend to Vercel
vercel --prod

# Awardspace: upload api/ folder + .env via FTP
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Blank page on Vercel | Missing `vercel.json` rewrite | Ensure SPA rewrite is in place |
| API returns 404 | Wrong path on Awardspace | Check `api/` is at `public_html/api/` |
| CORS error in browser | `ALLOWED_ORIGINS` mismatch | Add your Vercel domain to `ALLOWED_ORIGINS` |
| DB connection error | Wrong credentials in `.env` | Check DB_HOST, DB_NAME, DB_USER, DB_PASS |
| API won't load | `.env` in wrong directory | Move `.env` to parent of `api/` folder |
