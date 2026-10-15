#!/usr/bin/env bash
# GlassTodo one-click starter (Linux / Mac). Double-click or run: ./start.sh
# No manual commands needed: installs, builds, starts, opens browser.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found."
  echo "Install Node 18+ once from https://nodejs.org then re-run ./start.sh"
  exit 1
fi

echo "== GlassTodo starting =="

if [ ! -d frontend/node_modules ]; then
  echo "-- first run: installing frontend (one time) --"
  npm --prefix frontend install --no-audit --no-fund || exit 1
fi
if [ ! -d backend/node_modules ]; then
  echo "-- first run: installing backend (one time) --"
  npm --prefix backend install --no-audit --no-fund || exit 1
fi

if [ ! -d frontend/dist ]; then
  echo "-- first run: building app (one time) --"
  npm --prefix frontend run build || exit 1
fi

PORT="${PORT:-4000}"
echo "-- opening http://localhost:$PORT (if busy, app picks the next free port — watch the message) --"
# open browser quietly; failures are fine (user can open the URL manually)
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 2 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &) || true
elif command -v open >/dev/null 2>&1; then
  (sleep 2 && open "http://localhost:$PORT" >/dev/null 2>&1 &) || true
fi

PORT="$PORT" node backend/server.js
