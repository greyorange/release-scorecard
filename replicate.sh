#!/usr/bin/env bash
# replicate.sh — one-shot replication of the Release Scorecard Dashboard.
#
# What this does:
#   1. Verifies prerequisites (git, node 20+, npm)
#   2. Clones the canonical repo (or pulls latest if already cloned)
#   3. Installs npm dependencies (~360 packages, ~40 s)
#   4. Creates .env from the template (you fill JIRA creds in afterwards)
#   5. Builds the React SPA so Express can serve it on a single port
#   6. Prints the commands to run / dev / build / Docker
#
# Usage:
#   bash replicate.sh                       # clones into ./release-scorecard
#   bash replicate.sh /opt/scorecard        # custom target dir
#   bash replicate.sh --no-build            # skip vite build step
#   bash replicate.sh --start               # also start the server when done
#
# Prereqs:
#   git, node >= 20, npm
#   (optional) Docker if you want the containerised path
#
# Tested on macOS 14+ and Ubuntu 22.04+.

set -euo pipefail

REPO="${RELEASE_DASHBOARD_REPO:-https://github.com/ashishrathoregreyorange/Release_Scorecard.git}"
TARGET="./release-scorecard"
DO_BUILD=1
DO_START=0

# ----------------- arg parsing ----------------------------------------- #
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) DO_BUILD=0; shift ;;
    --start)    DO_START=1; shift ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0 ;;
    --*)
      echo "unknown option: $1" >&2
      exit 1 ;;
    *)
      TARGET="$1"; shift ;;
  esac
done

# ----------------- helpers --------------------------------------------- #
step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

# ----------------- 1. prereqs ----------------------------------------- #
step "Checking prerequisites"
require_cmd git
require_cmd node
require_cmd npm
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "node $NODE_MAJOR detected — please install node >= 20"
fi
ok "git $(git --version | awk '{print $3}')"
ok "node $(node -v)"
ok "npm $(npm -v)"

# ----------------- 2. clone / update ---------------------------------- #
step "Fetching source"
if [ -d "$TARGET/.git" ]; then
  ok "existing clone found at $TARGET — pulling latest"
  git -C "$TARGET" pull --ff-only
else
  ok "cloning $REPO → $TARGET"
  git clone "$REPO" "$TARGET"
fi

cd "$TARGET/release-dashboard"

# ----------------- 3. install ----------------------------------------- #
step "Installing npm dependencies"
npm install --no-audit --no-fund
ok "dependencies installed"

# ----------------- 4. .env -------------------------------------------- #
step "Configuring .env"
if [ -f .env ]; then
  ok ".env already exists — leaving alone"
else
  cp .env.example .env
  ok ".env created from template"
  warn "edit $PWD/.env to set JIRA_EMAIL / JIRA_API_TOKEN / JIRA_FILTER_ID for live JIRA tables"
fi

# ----------------- 5. build ------------------------------------------- #
if [ "$DO_BUILD" -eq 1 ]; then
  step "Building the React SPA"
  npm run build
  ok "dist/ built — Express will serve the SPA on the same port as the API"
else
  warn "skipping build (--no-build); you'll need 'npm run dev' or 'npm run build' before serving"
fi

# ----------------- 6. summary ----------------------------------------- #
ROOT_ABS="$(cd "$TARGET" && pwd)"
DASHBOARD_ABS="$ROOT_ABS/release-dashboard"

cat <<EOF

================================================================
Replication complete.

Project root : $ROOT_ABS
Dashboard    : $DASHBOARD_ABS

Run options
-----------
  cd $DASHBOARD_ABS

  # production-style (Express serves built SPA + API on :3000)
  npm start

  # dev mode (vite on :5173 with HMR, API on :3000 — concurrent)
  npm run dev

  # docker (uses the existing Dockerfile + docker-compose.yml)
  docker compose up -d --build

Sample data
-----------
  $DASHBOARD_ABS/data/*.csv
  Drop new CSVs into that folder; the watcher auto-ingests within ~500ms.
  Or click 'Upload CSV' / '+ New Release' inside the dashboard UI.

Routes
------
  /api/health
  /api/projects                 latest release per project
  /api/releases                 every release, flat list
  /api/projects/:id             one release + capa
  /api/projects/:id/history     score trend
  /api/projects/:id/edit        (SPA route — edit form)
  /api/jira/issues              POST {ids:[...]} → live JIRA table data
  /api/export/:id/pdf           puppeteer-rendered PDF
================================================================

EOF

if [ "$DO_START" -eq 1 ]; then
  step "Starting server on port \${DASHBOARD_PORT:-3000}"
  exec npm start
fi
