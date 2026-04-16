#!/bin/zsh
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

cd /Users/stakursk/Projects/trmnl-server/docker/prod

log() {
  echo "[trmnl] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

if ! command -v docker >/dev/null 2>&1; then
  log "docker not found"
  exit 1
fi

if [ ! -f .env ]; then
  log "missing docker/prod/.env"
  exit 1
fi

log "syncing repository"
git -C /Users/stakursk/Projects/trmnl-server pull --ff-only origin main

log "starting docker compose stack"
exec docker compose up
