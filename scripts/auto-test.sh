#!/usr/bin/env bash
set -euo pipefail

DURATION=60
RATE=2
ANOMALY_CHANCE=10
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
ADMIN_USER="${SEED_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${SEED_ADMIN_PASSWORD:-Admin123!}"

for arg in "$@"; do
  case "$arg" in
    --duration=*) DURATION="${arg#*=}" ;;
    --rate=*) RATE="${arg#*=}" ;;
    --anomaly-chance=*) ANOMALY_CHANCE="${arg#*=}" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

TOKEN=$(curl -sf -X POST "$BACKEND_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

CITIES=(Istanbul Ankara Izmir Bursa Adana Konya Gaziantep)
FAR_CITIES=("New York" Tokyo Sydney "Sao Paulo")

post() {
  curl -sf -o /dev/null -X POST "$BACKEND_URL/api/transactions" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\":\"$1\",\"amount\":$2,\"location\":\"$3\"}" || true
}

rand_city() { echo "${CITIES[$((RANDOM % ${#CITIES[@]}))]}"; }

normal() {
  local user="auto-$((RANDOM % 20))"
  post "$user" "$((20 + RANDOM % 800)).00" "$(rand_city)"
}

anomaly() {
  case $((RANDOM % 3)) in
    0)
      local user="auto-velocity-$((RANDOM % 5))"
      for _ in $(seq 1 7); do post "$user" "90.00" "$(rand_city)"; done
      ;;
    1)
      local user="auto-amount-$((RANDOM % 5))"
      post "$user" "80.00" "$(rand_city)"
      post "$user" "80.00" "$(rand_city)"
      post "$user" "5000.00" "$(rand_city)"
      ;;
    2)
      local user="auto-location-$((RANDOM % 5))"
      post "$user" "150.00" "Istanbul"
      post "$user" "150.00" "${FAR_CITIES[$((RANDOM % ${#FAR_CITIES[@]}))]}"
      ;;
  esac
}

END=$((SECONDS + DURATION))
SENT=0
while [[ $SECONDS -lt $END ]]; do
  for _ in $(seq 1 "$RATE"); do
    if [[ $((RANDOM % 100)) -lt $ANOMALY_CHANCE ]]; then
      anomaly
    else
      normal
    fi
    SENT=$((SENT + 1))
  done
  sleep 1
done

echo "Done: ~$SENT request batch(es) over ${DURATION}s at ${RATE}/s, anomaly chance ${ANOMALY_CHANCE}%."
