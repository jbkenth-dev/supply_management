# Deployment Guide — SFC-G Supply Management

## Architecture (HTTP-only Awardspace + Vercel Proxy)

```
Browser (User)
    │
    ├── https://your-vercel-app.vercel.app  (Frontend — React SPA)
    │     │
    │     │  fetch("/api/public-supplies.php")
    │     │       ↓
    │     │  Vercel rewrites /api/* → http://your-awardspace.com/api/*
    │     │         ↓
    │     └─── Vercel proxies to Awardspace over HTTP (server-to-server)
    │
    └── Awardspace Shared Hosting  (Backend — PHP + MySQL)
          ├── api/*.php
          ├── api/config/*.php
          └── .env
```

**Why this matters:** Awardspace only supports HTTP, not HTTPS. If the frontend on Vercel (HTTPS) tried to call Awardspace directly (HTTP), the browser would **block the request** due to mixed-content security rules. Instead, Vercel acts as a proxy — the browser sees same-origin HTTPS requests, and Vercel forwards them to Awardspace over HTTP internally.

No CORS issues. No mixed-content warnings.

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
VITE_API_BASE_URL=
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://your-frontend-domain.example

DB_HOST=localhost
DB_PORT=3306
DB_NAME=youruser_supply
DB_USER=youruser_dbuser
DB_PASS=your_strong_password

SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_NAME=your_sender_name
SMTP_FROM_EMAIL=your_sender_email
SMTP_API_KEY=your_brevo_api_key
SMTP_ENCRYPTION=auto
SMTP_TIMEOUT=20
SMTP_VERIFY_PEER=false
SMTP_VERIFY_PEER_NAME=false
```

> ⚠️ **File location matters!** The PHP `env.php` looks for `.env` using `dirname(__DIR__, 2)` from `api/config/env.php`. If `api/` is at `public_html/api/`, then `.env` goes in **`public_html/.env`**.

### 2b. Upload Files via FTP/cPanel
Upload the entire `api/` folder to `public_html/api/` on Awardspace.

**Do not upload `node_modules/`, `src/`, `dist/`, or any frontend files.**

### 2c. Verify Backend
Check your Awardspace site directly:
```
http://your-awardspace.com/api/public-supplies.php
```
Expected: A JSON response. If you see an error, check the `.env` database credentials.

---

## Step 3: Vercel — Frontend

### 3a. Create a Vercel Account and Project
1. Go to [vercel.com](https://vercel.com) and sign up (GitHub login recommended)
2. Install Vercel CLI: `npm i -g vercel`
3. Or connect your GitHub repo directly in the Vercel dashboard

### 3b. Update `vercel.json` with Your Awardspace URL
Edit the [vercel.json](vercel.json) file in your project root:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "http://your-awardspace-domain.com/api/$1"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Replace `http://your-awardspace-domain.com`** with your actual Awardspace URL (e.g., `http://youruser.awardspace.com`).

### 3c. Build and Deploy

**Option A — Vercel CLI:**
```bash
npm install
npm run build
vercel --prod
```

**Option B — GitHub Integration:**
1. Push to GitHub
2. Import repo in Vercel dashboard
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. No environment variables needed — `VITE_API_BASE_URL` stays empty
7. Deploy

> ⚠️ **After first deploy**, update `vercel.json` with your Awardspace URL and redeploy. The proxy won't work until the `destination` points to the correct Awardspace domain.

---

## Step 4: How It All Connects

### Local Development
```
npm run dev
```
Vite dev server → proxies `/api/*` to `http://localhost/supply_management/api/` (via vite.config.ts)

### Production (Vercel + Awardspace)
```
Browser → https://your-app.vercel.app/api/public-supplies.php
              ↓
         Vercel rewrite → http://your-awardspace.com/api/public-supplies.php
              ↓
         Awardspace PHP serves the response
              ↓
         Vercel passes response back to the browser
```

The frontend is built with `VITE_API_BASE_URL=""` (empty), so all `api("/api/...")` calls become same-origin requests. Vercel's `vercel.json` rewrites handle the rest.

### CORS (for local dev only)
The `ALLOWED_ORIGINS` in `.env` only matters when running locally (Vite dev server → XAMPP). In production, requests are same-origin via the Vercel proxy, so CORS doesn't apply.

---

## Step 5: Updating After Changes

### Frontend changes only
```bash
npm run build
vercel --prod
```

### Backend changes only
Upload the modified PHP files to Awardspace via FTP.

### Database changes
Export updated SQL from phpMyAdmin → re-import on Awardspace.

---

## Quick Reference

```bash
# Local dev
npm run dev

# Build for production
npm run build

# Deploy frontend to Vercel
vercel --prod

# Awardspace: upload api/ folder + .env via FTP
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|------|
| Blank page on Vercel | Missing `vercel.json` rewrite | Ensure `{ "source": "/(.*)", "destination": "/index.html" }` exists |
| API returns 404 on Vercel | Wrong Awardspace domain in `vercel.json` | Update the `/api/(.*)` rewrite destination |
| API works locally but not on Vercel | `vercel.json` proxy URL incorrect | Check `destination` points to Awardspace HTTP URL |
| DB connection error | Wrong credentials in `.env` | Check DB_HOST, DB_NAME, DB_USER, DB_PASS on Awardspace |
| API won't load | `.env` in wrong directory | Move `.env` to the parent of `api/` folder on Awardspace |
| Vite proxy not working locally | XAMPP not running | Start Apache/MySQL in XAMPP first |
