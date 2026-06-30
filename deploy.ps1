<#
.SYNOPSIS
  Supply Management — Deployment Script (PowerShell)
.DESCRIPTION
  Builds the frontend and guides you through deploying to Vercel + Awardspace.
.PARAMETER VercelToken
  Optional Vercel API token if you want CLI-based deploy.
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " SFC-G Supply Management — Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. Validate environment ──────────────────────────────────────────────
if (-not (Test-Path ".env")) {
  Write-Host "[!] .env file not found. Copy .env.example to .env and fill in values." -ForegroundColor Red
  exit 1
}

# ── 2. Install dependencies ──────────────────────────────────────────────
Write-Host "[1/5] Installing frontend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

# ── 3. Build frontend ────────────────────────────────────────────────────
Write-Host "[2/5] Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
Write-Host "      ✓ Build written to dist/" -ForegroundColor Green

# ── 4. Deploy frontend to Vercel ─────────────────────────────────────────
Write-Host "[3/5] Deploying frontend to Vercel..." -ForegroundColor Yellow
$hasVercel = Get-Command "vercel" -ErrorAction SilentlyContinue
if ($hasVercel) {
  vercel --prod --yes
  Write-Host "      ✓ Frontend deployed to Vercel" -ForegroundColor Green
} else {
  Write-Host "      [!] Vercel CLI not found. Install: npm i -g vercel" -ForegroundColor Yellow
  Write-Host "      Then deploy: vercel --prod" -ForegroundColor Yellow
}

# ── 5. Backend deployment guide ──────────────────────────────────────────
Write-Host "[4/5] Backend → Awardspace" -ForegroundColor Yellow
Write-Host @"

  Upload via FTP or cPanel File Manager:

  ┌─ Files ──────────────────────────────────────────┐
  │  api/config/cors.php            (NEW)            │
  │  api/config/database.php                         │
  │  api/config/env.php                              │
  │  api/config/email.php                            │
  │  api/config/notifications.php                    │
  │  api/config/admin_inventory.php (MODIFIED)       │
  │  api/config/user_schema.php                      │
  │  api/*.php                    (all, MODIFIED)    │
  │  .env                        (production)       │
  └──────────────────────────────────────────────────┘

  Target: /public_html/api/  (or your web root)

"@

# ── 6. Database ──────────────────────────────────────────────────────────
Write-Host "[5/5] Database" -ForegroundColor Yellow
Write-Host @"
  1. Create a MySQL database in Awardspace cPanel
  2. Import supply_management (v.1).sql via phpMyAdmin
  3. Update .env with Awardspace DB credentials

"@

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Post-deploy checklist:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host @"
  ☐ Set VITE_API_BASE_URL in .env (used at build time)
  ☐ Set ALLOWED_ORIGINS in .env (comma-separated)
  ☐ Import SQL dump into Awardspace MySQL
  ☐ Upload api/ folder to Awardspace
  ☐ Upload .env to Awardspace web root
  ☐ Test: curl https://your-awardspace.com/api/public-supplies.php
  ☐ Visit Vercel URL to verify frontend loads
"@
