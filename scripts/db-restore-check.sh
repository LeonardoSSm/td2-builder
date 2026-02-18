#!/usr/bin/env bash
set -euo pipefail

# Restore-check for the latest backup:
# - verifies gzip integrity
# - restores into a temporary DB inside docker-compose postgres
# - runs a simple query
# - drops the temporary DB
#
# Usage:
#   bash scripts/db-restore-check.sh
# Optional env:
#   OUT_DIR=data/backups
#   DB_SERVICE=postgres
#   DB_NAME=td2_builder
#   DB_USER=td2

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${OUT_DIR:-data/backups}"
SERVICE="${DB_SERVICE:-postgres}"
DB_NAME="${POSTGRES_DB:-td2_builder}"
DB_USER="${POSTGRES_USER:-td2}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker first."
  exit 1
fi

cid="$(docker compose ps -q "$SERVICE" 2>/dev/null || true)"
if [[ -z "${cid}" ]]; then
  echo "Postgres container is not running. Start it with: docker compose up -d"
  exit 1
fi

latest="$(ls -1t "${OUT_DIR}/${DB_NAME}"_*.sql.gz 2>/dev/null | head -n1 || true)"
if [[ -z "$latest" ]]; then
  echo "No backup files found in ${OUT_DIR} for database prefix ${DB_NAME}_*.sql.gz"
  exit 1
fi

echo "Restore-check using backup:"
echo "  ${latest}"

gzip -t "$latest"
echo "Gzip integrity OK."

tmp_db="${DB_NAME}_restorecheck_$(date +%Y%m%d_%H%M%S)"
echo "Creating temporary DB: ${tmp_db}"
docker compose exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${tmp_db}\";"

cleanup() {
  echo "Dropping temporary DB: ${tmp_db}"
  docker compose exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${tmp_db}' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS \"${tmp_db}\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Restoring backup into temporary DB..."
gunzip -c "$latest" | docker compose exec -T "$SERVICE" psql -U "$DB_USER" -d "$tmp_db" -v ON_ERROR_STOP=1 >/dev/null

echo "Running sanity query..."
docker compose exec -T "$SERVICE" psql -U "$DB_USER" -d "$tmp_db" -v ON_ERROR_STOP=1 -c "SELECT 1;" >/dev/null

echo "Restore-check OK."

