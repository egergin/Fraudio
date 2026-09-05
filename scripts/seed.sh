#!/usr/bin/env bash
set -euo pipefail
[[ -f .env ]] || { echo ".env.example dosyasını .env olarak kopyalayın ve yapılandırın."; exit 1; }
set -a; source .env; set +a

echo "Başlangıç sentetik demo işlemleri gönderiliyor..."
entries=(
  'customer-100 45.00 Istanbul'
  'customer-100 50.00 Istanbul'
  'customer-101 120.00 Ankara'
  'customer-102 35.00 Izmir'
  'customer-100 850.00 London'
  'customer-103 95.00 Bursa'
  'customer-103 1200.00 Tokyo'
)

for entry in "${entries[@]}"; do
  read -r user amount location <<<"$entry"
  echo "$user için işlem alınıyor: $amount ₺, konum: $location"
  ./scripts/manual-input.sh "$user" "$amount" "$location"
  sleep 0.5
done

echo "Demo işlemleri başarıyla gönderildi."
echo "Uygulama kullanıcıları ('admin', 'analyst') backend başlatılırken otomatik olarak oluşturulur."
