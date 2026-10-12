#!/bin/zsh
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export LIMA_HOME="/Users/stakursk/.colima/_lima"
export DOCKER_HOST="unix:///Users/stakursk/.colima/default/docker.sock"

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

log "waiting for docker daemon"
if ! docker info >/dev/null 2>&1 && command -v colima >/dev/null 2>&1; then
  log "docker daemon unavailable; starting colima"
  if ! colima status >/dev/null 2>&1; then
    limactl stop -f colima >/dev/null 2>&1 || true
  fi
  colima start || true
fi

for i in {1..180}; do
  if docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker info >/dev/null 2>&1; then
  log "docker daemon not ready after wait"
  exit 1
fi

if git -C /Users/stakursk/Projects/trmnl-server diff --quiet && git -C /Users/stakursk/Projects/trmnl-server diff --cached --quiet; then
  log "syncing repository"
  git -C /Users/stakursk/Projects/trmnl-server pull --ff-only origin main
else
  log "repository has local changes; skipping pull"
fi

log "starting docker compose stack"
exec docker compose up
