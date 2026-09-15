
# Fraudio

Fraudio e-ticaret işlemlerini anlık izleyip şüpheli işlemleri yakalayan uçtan uca çalışan bir fraud monitoring uygulamasıdır. İşlem gönderilir, kuyruk üzerinden asenkron işlenir, kurallarla değerlendirilir ve sonuç dashboard üzerinde görünür.

## Özellikler
- **İşlem Hattı:** API üzerinden alınan işlem RabbitMQ worker'a düşer, fraud servisinden geçer, PostgreSQL'e yazılır ve WebSocket ile panele yansır.
- **3 Kural:** Hız (Dakikada 6+ işlem), Tutar (24 saatlik ortalamanın 3 katı),
  konum (işlem konumları arasındaki mesafe).<br>0–1 ihlal ─▶ onay, 2–3 ihlal ─▶ şüpheli
- **Operasyon Paneli:** Kontrol paneli, şüpheli işlem uyarıları, tüm işlemleri görüntüleme, sistem durumu kontrolü ve kullanıcı detayı sayfaları
- **MCP erişimi:** Agentlar son şüpheli işlemleri ve belirli bir kullanıcının özetini MCP server üzerinden sorgulayabilir.

## Mimari
Backend (API + worker) + React + MCP server<br>`Domain → Application → Infrastructure → Api`.

```
React ──HTTP──▶ Api ──validate + publish──▶ RabbitMQ ──▶ BackgroundService
                                                        ├─▶ Redis
                                                        ├─▶ IGeolocationService → Open-Meteo API
                                                        ├─▶ FraudDetectionService
                                                        ├─▶ PostgreSQL
                                                        └─▶ FraudDetected ──▶ RabbitMQ ──▶ WebSocket ──▶ React
AI Agent ──HTTP──▶ MCP Container ──HTTP──▶ Api
```

Detay için ─▶ `docs/architecture.md`<br>
Kurallar için ─▶ `docs/fraud-rules.md`

## Nasıl Çalıştırılır?
```bash
cp .env.example .env
docker compose up --build
```

| Servis | Adres |
|---|---|
| Dashboard | http://localhost:5173 |
| Backend | http://localhost:8080 |
| MCP | http://localhost:8090 |
| RabbitMQ | http://localhost:15672 |

- `admin / Admin123!`
- `analyst / Analyst123!`

## Endpointler
| Route | Sayfa |
|---|---|
| `/` | Kontrol Paneli: KPI'lar, pasta/işlem/hacim grafikleri, son işlemler, uyarılar |
| `/uyarilar` | Uyarılar: şüpheli işlem tablosu, filtreler |
| `/canli` | Tüm İşlemler: arama, durum/tarih filtresi |
| `/sistem` | Sistem Durumu (Admin): PostgreSQL, Redis, RabbitMQ servislerinin durumu |
| `/users/:userId` | Kullanıcı detayı: özet + son 20 işlemi |
| `/login` | JWT girişi |

## API özeti
| Endpoint | Yetki |
|---|---|
| `POST /api/auth/login` → `{token,username,role}` | Herkese Açık |
| `POST /api/transactions` `{userId,amount,location}` → `202 {transactionId,"Accepted"}` | Admin |
| `GET /api/transaction-users/{userId}`, `.../transactions` (son 20 işlem) | Admin/Analyst |
| `GET /api/frauds/recent` | Admin/Analyst |
| `GET /api/transactions/recent` | Admin/Analyst |
| `GET /api/dashboard/summary`, `.../series` | Admin/Analyst |
| `GET /api/admin/users`, `GET /api/system/health` | Admin |
| `/ws` | Admin/Analyst |

Detay için ─▶ `docs/api.md`.

## Veri Üretmek İçin
```bash
./scripts/seed.sh                                         # normal + şüpheli işlem demo verisi
./scripts/manual-input.sh user-123 1250.50 Istanbul   # tek işlem
./scripts/auto-test.sh --duration=60 --rate=2 --anomaly-chance=20
```

## MCP

Endpoint ─▶ `POST http://localhost:8090/mcp`
- `get_recent_frauds({limit})` → son şüpheli işlemler
- `check_user_status({userId})` → `{userId,totalTransactions,suspiciousTransactions,lastTransaction}`

Detay için ─▶ `docs/mcp.md`

## Testler
```bash
dotnet test backend/Fraudio.slnx
```

## Proje Yapısı
```
backend/src/Fraudio.{Api,Application,Domain,Infrastructure,Mcp}/
backend/tests/Fraudio.Tests/
frontend/src/{pages,components,i18n,assets}/
scripts/{seed,manual-input,auto-test}.sh
docs/{architecture,fraud-rules,api,mcp,testing}.md
docker-compose.yml · .env.example
```

## Notlar
- Para birimi `decimal`, zaman UTC tutulur, kontrol panelinde Türkiye saatiyle gösterilir.
- Redis geçici veri tutar, kalıcı veri PostgreSQL veritabanında tutulur.