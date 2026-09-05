#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 3 ]] || { echo "Kullanım: $0 <kullanici_id> <tutar> <konum>"; exit 1; }
[[ -f .env ]] && set -a && source .env && set +a
: "${API_BASE_URL:=http://localhost:8080}"; : "${ADMIN_USERNAME:?Set ADMIN_USERNAME}"; : "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
token=$(curl -fsS -X POST "$API_BASE_URL/api/auth/login" -H 'Content-Type: application/json' --data "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[[ -n "$token" ]] || { echo "Giriş başarısız"; exit 1; }
curl -fsS -X POST "$API_BASE_URL/api/transactions" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "{\"userId\":\"$1\",\"amount\":$2,\"location\":\"$3\"}"
echo
