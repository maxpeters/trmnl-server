#!/bin/zsh
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

cd /Users/stakursk/Projects/trmnl-server

log() {
  echo "[trmnl] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "syncing repository"
git pull --ff-only origin main

if command -v npm >/dev/null 2>&1; then
  log "installing node dependencies"
  npm install --prefer-offline --no-audit

  log "building assets"
  npm run build
else
  log "npm not found, skipping asset install/build"
fi

if [ -f artisan ]; then
  log "starting LaraPaper dev server"
  exec php artisan serve --host=0.0.0.0 --port=4567
fi

if [ -f dist/server.js ] && command -v node >/dev/null 2>&1; then
  log "starting legacy node server"
  exec node dist/server.js
fi

log "no runnable server entrypoint found"
exit 1
