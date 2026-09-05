# Fraudio Mimari Tasarım

## 1. Üst Düzey Topoloji

```text
React Ön Yüz (5173)
       |
       | HTTP / REST
       v
ASP.NET Core Backend (8080)
       |
       | doğrulama + yayınlama (transaction.received)
       v
RabbitMQ (5672) [fraud-platform.exchange]
       |
       v
TransactionWorker (HostedService)
       |
       +--> Redis Durum Deposu (6379)
       |       - Hız kayar penceresi (Sorted Set)
       |       - 24 saatlik tutar toplamaları (Sorted Set)
       |       - Son konum anlık görüntüsü (Hash)
       |       - Coğrafi konum önbelleği (String)
       |
       +--> Coğrafi Konum Sağlayıcı (Open-Meteo + Redis önbellek yedeklemesi)
       |
       v
Sahtekarlık Tespit Motoru (Domain)
       |
       v
PostgreSQL 16 (5432)
       |
       v
RabbitMQ Bildirim Kuyruğu [fraud.detected]
       |
       v
WebSocket Gerçek Zamanlı Bildirim (/ws)
       |
       v
React Paneli (Gerçek Zamanlı Canlı Akış)
```

## 2. MCP Entegrasyonu

```text
YZ Ajanı
   |
   | JSON-RPC 2.0 (Akışlı HTTP POST /mcp)
   v
MCP Sunucu Konteyneri (3000, Compose Dahili Ağ)
   |
   | HTTP REST + JWT (Bearer admin token)
   v
ASP.NET Core Backend API (8080)
   |
   +--> /api/frauds/recent
   +--> /api/transaction-users/{userId}
```

* MCP Sunucusu PostgreSQL veya Redis'e **doğrudan erişime sahip değildir**.
* Oluşturulan Admin kimlik bilgilerini kullanarak backend API'leri üzerinden katı bir adaptör olarak çalışır.

## 3. Dayanıklılık ve Mesajlaşma Detayları

* **Ölü Mektup Değişimi (DLX):** `fraud-platform.dlx`, `transaction.dlq` ve `notification.dlq` kuyruklarına yönlendirir.
* **Yeniden Deneme Stratejisi:** `x-retry-count` mesaj başlığı ile izlenen en fazla 3 yeniden deneme. 3 denemeyi aşan mesajlar doğrudan ölü mektup kuyruğuna nack edilir.
* **İdempotentlik:** Eklemeden önce PostgreSQL'de `TransactionId` üzerinden benzersizlik kontrolü.
