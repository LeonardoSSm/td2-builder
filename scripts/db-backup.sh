#!/usr/bin/env bash
set -euo pipefail

# Creates a timestamped Postgres dump from the docker-compose Postgres container.
# Output: data/backups/*.sql.gz
#
# Usage:
#   bash scripts/db-backup.sh
#
# Notes:
# - Requires: docker + docker compose
# - Safe: read-only operation (backup only).
# - Optional retention cleanup via BACKUP_RETENTION_DAYS (default: 14)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${OUT_DIR:-data/backups}"
SERVICE="${DB_SERVICE:-postgres}"
DB_NAME="${POSTGRES_DB:-td2_builder}"
DB_USER="${POSTGRES_USER:-td2}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$OUT_DIR"

ts="$(date +%Y%m%d_%H%M%S)"
out="${OUT_DIR}/${DB_NAME}_${ts}.sql.gz"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker first."
  exit 1
fi

if ! docker compose ps -q "$SERVICE" >/dev/null 2>&1; then
  echo "docker compose service '$SERVICE' not found."
  echo "Check docker-compose.yml or set DB_SERVICE=..."
  exit 1
fi

cid="$(docker compose ps -q "$SERVICE" 2>/dev/null || true)"
if [[ -z "${cid}" ]]; then
  echo "Postgres container is not running. Start it with: docker compose up -d"
  exit 1
fi

echo "Backing up database '${DB_NAME}' from service '${SERVICE}' to:"
echo "  ${out}"

# Use the container's pg_dump to avoid relying on host tooling.
docker compose exec -T "$SERVICE" pg_dump \
  --no-owner \
  --no-privileges \
  -U "$DB_USER" \
  "$DB_NAME" | gzip -9 > "$out"

echo "Backup finished."

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "Applying retention: removing backups older than ${RETENTION_DAYS} days from ${OUT_DIR}"
  find "$OUT_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete || true
fi
