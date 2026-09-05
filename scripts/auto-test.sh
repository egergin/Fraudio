#!/usr/bin/env bash
set -euo pipefail
duration=30; rate=1; anomaly=20
for arg in "$@"; do case "$arg" in --duration=*) duration=${arg#*=};; --rate=*) rate=${arg#*=};; --anomaly-chance=*) anomaly=${arg#*=};; *) echo "Bilinmeyen seçenek: $arg"; exit 1;; esac; done
[[ "$duration" =~ ^[0-9]+$ && "$rate" =~ ^[1-9][0-9]*$ && "$anomaly" =~ ^([0-9]|[1-9][0-9]|100)$ ]] || { echo "Geçersiz seçenekler"; exit 1; }
end=$((SECONDS + duration)); count=0
while (( SECONDS < end )); do
  user="load-user-$((RANDOM % 10))"; amount="$((20 + RANDOM % 100)).50"; location="Istanbul"
  if (( RANDOM % 100 < anomaly )); then
    case $((RANDOM % 3)) in 0) user="velocity-user"; amount="25.00";; 1) user="amount-user"; amount="5000.00";; 2) user="location-user"; location="New York";; esac
  fi
  ./scripts/manual-input.sh "$user" "$amount" "$location" >/dev/null || echo "istek başarısız" >&2
  count=$((count + 1)); (( count % rate == 0 )) && sleep 1
done
echo "$count işlem gönderildi."
