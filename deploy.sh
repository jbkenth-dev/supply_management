#!/usr/bin/env bash
#
# Supply Management — Deployment Script
# Usage:  chmod +x deploy.sh && ./deploy.sh
#
# Prerequisites:
#   - Node.js 18+ and npm installed
#   - Vercel CLI installed (npm i -g vercel)
#   - Awardspace FTP/cPanel credentials ready
#   - .env file configured with production values
#
# Before running, export these or create a .env.production:
#   export VITE_API_BASE_URL=https://your-awardspace-domain.com
#   export ALLOWED_ORIGINS=https://your-vercel-app.vercel.app

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " SFC-G Supply Management — Deploy"
echo "========================================"

# ── 1. Validate environment ──────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "[!] .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# ── 2. Install dependencies ──────────────────────────────────────────────
echo "[1/5] Installing frontend dependencies..."
npm install

# ── 3. Build frontend ────────────────────────────────────────────────────
echo "[2/5] Building frontend..."
npm run build

if [ ! -d dist ]; then
  echo "[!] Build failed — dist/ directory not created."
  exit 1
fi

echo "      ✓ Build written to dist/"

# ── 4. Deploy frontend to Vercel ─────────────────────────────────────────
echo "[3/5] Deploying frontend to Vercel..."
if command -v vercel &> /dev/null; then
  vercel --prod --yes
  echo "      ✓ Frontend deployed to Vercel"
else
  echo "      [!] Vercel CLI not found. Run: npm i -g vercel"
  echo "      Then deploy manually: vercel --prod"
fi

# ── 5. Deploy backend to Awardspace ──────────────────────────────────────
echo "[4/5] Deploying backend to Awardspace..."
echo "      Upload via FTP/cPanel File Manager:"
echo ""
echo "      Source:   api/"
echo "      Target:   /public_html/api/  (or your web root)"
echo ""
echo "      Also upload .env to the root that env.php can reach:"
echo "      env.php looks for .env in:  dirname(__DIR__, 2)"
echo "      If api/ is at /public_html/api/, then .env goes in /public_html/"
echo ""
echo "      ┌─ Files to upload ──────────────────────────────┐"
echo "      │  api/config/cors.php            (NEW)          │"
echo "      │  api/config/database.php                       │"
echo "      │  api/config/env.php                            │"
echo "      │  api/config/email.php                          │"
echo "      │  api/config/notifications.php                  │"
echo "      │  api/config/admin_inventory.php (MODIFIED)     │"
echo "      │  api/config/user_schema.php                    │"
echo "      │  api/*.php                    (all, MODIFIED)  │"
echo "      │  .env                        (production)     │"
echo "      └────────────────────────────────────────────────┘"
echo ""
echo "      See: DEPLOYMENT.md for detailed Awardspace setup."

# ── 6. Database ──────────────────────────────────────────────────────────
echo "[5/5] Database setup"
echo "      1. Create a MySQL database in Awardspace cPanel"
echo "      2. Import supply_management (v.1).sql via phpMyAdmin"
echo "      3. Update .env with Awardspace DB credentials"
echo ""
echo "========================================"
echo " Deployment steps complete."
echo "========================================"
echo ""
echo " Post-deploy checklist:"
echo "   ☐ Set VITE_API_BASE_URL in .env (used at build time)"
echo "   ☐ Set ALLOWED_ORIGINS in .env"
echo "   ☐ Import SQL dump into Awardspace MySQL"
echo "   ☐ Upload api/ folder to Awardspace"
echo "   ☐ Upload .env to Awardspace web root"
echo "   ☐ Test: curl https://your-awardspace.com/api/public-supplies.php"
echo "   ☐ Visit Vercel URL to verify frontend loads"
echo ""
