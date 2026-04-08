#!/bin/zsh
set -e

export PATH="/usr/local/bin:/usr/bin:/bin"

cd /Users/stakursk/Projects/trmnl-server

echo "[trmnl] $(date) — pulling latest..."
git pull --ff-only origin main

echo "[trmnl] $(date) — building..."
/usr/local/bin/npm run build

echo "[trmnl] $(date) — starting server..."
exec /usr/local/bin/node dist/server.js
