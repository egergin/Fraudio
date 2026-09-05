# Fraudio — Gerçek Zamanlı E-Ticaret Anomali ve Dolandırıcılık Tespit Platformu

E-ticaret işlemlerini gerçek zamanlı olarak alan, RabbitMQ ile asenkron işleyen, Redis yapılarıyla karmaşık kullanıcı davranış kurallarını değerlendiren, anomalileri PostgreSQL'de kalıcı olarak saklayan, WebSocket üzerinden React paneline canlı uyarı telemetrisi aktaran ve yapay zekâ ajanlarına Model Context Protocol (MCP) aracılığıyla analiz yetenekleri sunan uçtan uca bir platform.

---

## 1. Sistem Mimarisi ve Bileşen Tasarımı

```text
React Ön Yüz (:5173)
       │
       ▼ (HTTP / REST)
ASP.NET Core Monolit (:8080)
       │
       ▼ (doğrulama & yayınlama)
RabbitMQ (:5672) ──────────► [fraud-platform.exchange]
                                       │
       ┌───────────────────────────────┘
       ▼
TransactionWorker (Barındırılan Arka Plan Servisi)
       │
       ├─► Redis Durum Deposu (:6379)
       │      • 1 dakikalık kayar hız penceresi (Sorted Set)
       │      • 24 saatlik tutar geçmişi (Sorted Set)
       │      • Son bilinen konum koordinatları (Hash)
       │      • Coğrafi konum önbelleği (String)
       │
       ├─► Coğrafi Konum Servisi (Open-Meteo + Redis Önbellek)
       │
       ▼
Sahtekarlık Tespit Motoru (Alan Kuralları Değerlendirmesi)
       │
       ▼
PostgreSQL 16 (:5432) [Birincil Doğruluk Kaynağı]
       │
       ▼
RabbitMQ Bildirim Kuyruğu ──► WebSocket Yayını (/ws) ──► React Paneli
```

```text
YZ Ajanı ──► MCP Sunucusu (:3000, Dahili Compose Ağı)
                 │
                 ▼ (HTTP REST + JWT Bearer Token)
             ASP.NET Core Backend API (:8080)
```

---

## 2. Teknoloji Yığını ve Gerekçeleri

| Teknoloji | Rol | Gerekçe |
| :--- | :--- | :--- |
| **.NET 10 / ASP.NET Core** | Monolitik Backend ve Worker | Yüksek performans, tür güvenliği, API ve BackgroundService'ler için birleşik süreç barındırma. |
| **PostgreSQL 16** | İlişkisel Doğruluk Kaynağı | Kullanıcılar, işlemler ve denetim sonuçları için ACID uyumlu depolama. |
| **Redis 7** | Gerçek Zamanlı Durum ve Bellek İçi Önbellek | Kayar pencere sayaçları ve koordinat önbelleği için mikrosaniye düzeyinde gecikme gereksinimi. |
| **RabbitMQ 4** | Mesaj Aracısı | Ayrıştırılmış işlem alımı, ölü mektup kuyruğu ve yeniden deneme garantileri. |
| **React 19 + Chart.js** | Ön Yüz Paneli | Gerçek zamanlı WebSocket akışları ve zamansal grafiklerle yüksek performanslı arayüz. |
| **Node.js (Express)** | MCP Sunucusu | YZ Ajanlarını API'lerine bağlayan JSON-RPC 2.0 arayüzü. |
| **Docker & Docker Compose** | Orkestrasyon | Ana makine bağımlılıkları olmadan yerel ortam çoğaltması. |

---

## 3. Sahtekarlık Tespit Kuralları

Her gelen işlem, üç kurala göre değerlendirilir:

1. **Hız Kuralı (Velocity):**
   * Bir kullanıcı **1 dakika içinde 5'ten fazla işlem** başlattığında ihlal gerçekleşir (yani 6. işlem ihlal eder).
   * Redis Sorted Set yapıları ile zaman damgaları kullanılır.

2. **Tutar Kuralı (Amount):**
   * İşlem tutarı, kullanıcının **son 24 saatteki işlem ortalamasının 3 katını** aştığında ihlal gerçekleşir.
   * Aynı tutarlar söz konusu olduğunda çakışmayı önlemek için `{transactionId}:{amount}` biçiminde benzersiz anahtarlarla Redis Sorted Set kullanılır.

3. **Konum Kuralı (İmkansız Seyahat):**
   * Kullanıcının önceki işlem koordinatları ile mevcut konum arasındaki seyahat süresini **Haversine formülü** kullanarak hesaplar.
   * Gerekli hız **800 km/saat**'i aştığında kural ihlal edilir.
   * Coğrafi konum verisi alınamayan veya çözümlenemeyen durumlarda işlem otomatik reddedilmez; konum kuralı bu işlemler için `Değerlendirilemedi` olarak işaretlenir.

### Nihai Karar Matrisi
* **0 veya 1 kural ihlali:** `Onaylandı`
* **2 veya 3 kural ihlali:** `Şüpheli`

---

## 4. Başlangıç ve Kurulum

### Ön Koşullar
* Docker Engine 24+ ve Docker Compose v2+
* (İsteğe bağlı) Testleri yerel olarak çalıştırmak için .NET 10 SDK

### 1. Ortam Yapılandırması
```bash
cp .env.example .env
```
`.env` dosyasını inceleyip isterseniz özel şifreler belirleyin.

### 2. Tüm Platformu Başlatma
```bash
docker compose up --build
```

Sistem otomatik sağlık kontrolleriyle başlayacaktır:
* **PostgreSQL:** `localhost:5432`
* **Redis:** `localhost:6379`
* **RabbitMQ Yönetim Paneli:** `http://localhost:15672` (Kimlik bilgileri `.env` dosyasında)
* **ASP.NET Core Backend:** `http://localhost:8080`
* **React Paneli:** `http://localhost:5173`
* **MCP Sunucusu:** Dahili konteyner ağı `http://mcp:3000/mcp`

Veritabanı migrasyonları ve varsayılan `Admin` ile `Analyst` kullanıcıları backend başlatılırken otomatik olarak oluşturulur.

---

## 5. Veri Besleme ve Betikler

### 1. Demo İşlemlerini Yükleme
```bash
./scripts/seed.sh
```
Paneli doldurmak için birden fazla kullanıcı üzerinden normal ve sahte işlem karışımı gönderir.

### 2. Manuel İşlem Gönderimi
```bash
./scripts/manual-input.sh <kullanici_id> <tutar> <konum>

# Örnek:
./scripts/manual-input.sh customer-100 1250.50 Istanbul
```

### 3. Otomatik Yük ve Anomali Üreteci
```bash
./scripts/auto-test.sh --duration=60 --rate=2 --anomaly-chance=30
```
Hız, tutar ve imkansız seyahat anomalileriyle sürekli sentetik trafik üretir.

---

## 6. Kimlik Doğrulama ve Roller

JWT Bearer token'ları `POST /api/auth/login` adresinden alınır.

| İşlem | Yönetici | Analist |
| :--- | :---: | :---: |
| Giriş ve Panel Görüntüleme | ✅ | ✅ |
| İşlem Gönderimi (`POST /api/transactions`) | ✅ | ❌ |
| Kullanıcı İnceleme Dosyası ve Geçmişi | ✅ | ✅ |
| Son Sahtekarlıkları Görüntüleme | ✅ | ✅ |
| Sistem Sağlığı (`GET /api/system/health`) | ✅ | ❌ |
| WebSocket Akış Erişimi (`/ws`) | ✅ | ✅ |

* Varsayılan Yönetici: `admin` / `${SEED_ADMIN_PASSWORD}`
* Varsayılan Analist: `analyst` / `${SEED_ANALYST_PASSWORD}`

---

## 7. Model Context Protocol (MCP) Entegrasyonu

MCP konteyneri, YZ Ajanları için `POST /mcp` adresinde JSON-RPC 2.0 uç noktası sunar.

### Desteklenen Araçlar:
1. `get_recent_frauds`:
   ```json
   { "limit": 20 }
   ```
2. `check_user_status`:
   ```json
   { "userId": "customer-100" }
   ```

### Docker Exec ile MCP Sorgulama:
```bash
docker compose exec mcp node -e "
fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'get_recent_frauds', arguments: { limit: 5 } }
  })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
"
```

---

## 8. Otomatik Testleri Çalıştırma

Tam test paketini çalıştırma (Alan Birimi Kuralları + API Entegrasyon Testleri):

```bash
DOTNET_CLI_HOME="$PWD/work/dotnet-cli" dotnet test backend/Fraudio.slnx
```

* `Fraudio.Domain.Tests`: Hız, tutar, Haversine imkansız seyahat ve karar mantığını kapsayan 8 test.
* `Fraudio.Api.Tests`: Kimlik doğrulama, RBAC, işlem alımı, kullanıcı inceleme dosyaları ve sistem sağlık kontrollerini kapsayan 10 entegrasyon testi.

---

## 9. Ek Dokümantasyon
* [Mimari Detaylı İnceleme](docs/architecture.md)
* [Sahtekarlık Kuralları Spesifikasyonu](docs/fraud-rules.md)
* [REST API ve WebSocket Referansı](docs/api.md)
* [MCP Sunucu Kılavuzu](docs/mcp.md)
* [Test Kılavuzu](docs/testing.md)
