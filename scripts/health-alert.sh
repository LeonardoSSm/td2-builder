#!/usr/bin/env bash
set -euo pipefail

# Health monitor + optional alert webhook.
# Usage:
#   bash scripts/health-alert.sh
# Optional env:
#   API_URL=http://127.0.0.1:3001/api
#   ALERT_WEBHOOK_URL=https://hooks.example/xxx
#   ALERT_PREFIX="[TD2]"
#   HEALTH_TIMEOUT_SEC=8

API_URL="${API_URL:-http://127.0.0.1:3001/api}"
WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
PREFIX="${ALERT_PREFIX:-[TD2]}"
TIMEOUT="${HEALTH_TIMEOUT_SEC:-8}"

send_alert() {
  local msg="$1"
  echo "$msg" >&2
  if [[ -n "$WEBHOOK_URL" ]]; then
    curl -sS -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"${msg//\"/\\\"}\"}" >/dev/null || true
  fi
}

check_json_ok() {
  local url="$1"
  local out
  out="$(curl -sS --max-time "$TIMEOUT" "$url" || true)"
  if [[ -z "$out" ]]; then
    return 1
  fi
  echo "$out" | grep -q '"ok":true'
}

if ! check_json_ok "$API_URL/health/ready"; then
  send_alert "$PREFIX health/ready failed at $(date -Iseconds) on ${API_URL}"
  exit 1
fi

if ! check_json_ok "$API_URL/health"; then
  send_alert "$PREFIX health failed at $(date -Iseconds) on ${API_URL}"
  exit 1
fi

echo "$PREFIX health checks OK at $(date -Iseconds)"
