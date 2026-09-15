#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
ADMIN_USER="${SEED_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${SEED_ADMIN_PASSWORD:-Admin123!}"

echo "Waiting for backend at $BACKEND_URL ..."
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null -X POST "$BACKEND_URL/api/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}"; then
    break
  fi
  sleep 2
done

TOKEN=$(curl -sf -X POST "$BACKEND_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Logged in as $ADMIN_USER."

post() { # <user> <amount> <location>
  curl -sf -o /dev/null -X POST "$BACKEND_URL/api/transactions" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\":\"$1\",\"amount\":$2,\"location\":\"$3\"}"
}

USERS=(customer-101 customer-102 customer-103 customer-104 customer-105)
CITIES=(Istanbul Ankara Izmir Bursa Adana)

echo "Submitting normal traffic ..."
for user in "${USERS[@]}"; do
  for _ in $(seq 1 6); do
    amount=$((50 + RANDOM % 900))
    city=${CITIES[$((RANDOM % ${#CITIES[@]}))]}
    post "$user" "$amount.00" "$city"
  done
done

echo "Submitting anomalies (velocity burst + amount spike + impossible travel) ..."
for _ in $(seq 1 7); do
  post "anomaly-velocity" "120.00" "Istanbul"
done
for _ in $(seq 1 3); do
  post "anomaly-amount" "100.00" "Ankara"
done
post "anomaly-amount" "5000.00" "Ankara"
# Location: back-to-back distant cities.
post "anomaly-location" "200.00" "Istanbul"
post "anomaly-location" "200.00" "New York"

echo "Seed submitted. Suspicious outcomes land in a few seconds (worker + WebSocket)."
