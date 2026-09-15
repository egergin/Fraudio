#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <user_id> <amount> <location>" >&2
  exit 1
fi

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
ADMIN_USER="${SEED_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${SEED_ADMIN_PASSWORD:-Admin123!}"

TOKEN=$(curl -sf -X POST "$BACKEND_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -sf -X POST "$BACKEND_URL/api/transactions" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"$1\",\"amount\":$2,\"location\":\"$3\"}"
echo
