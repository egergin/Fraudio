
# Mimari
```
React ──HTTP──▶ Api ──validate + publish──▶ RabbitMQ ──▶ BackgroundService
                                                        ├─▶ Redis
                                                        ├─▶ IGeolocationService → Open-Meteo API
                                                        ├─▶ FraudDetectionService
                                                        ├─▶ PostgreSQL
                                                        └─▶ FraudDetected ──▶ RabbitMQ ──▶ WebSocket ──▶ React
AI Agent ──HTTP──▶ MCP Container ──HTTP──▶ Api
```

## Projeler
| Proje | Rol |
|---|---|
| `Fraudio.Domain` | Entity'ler, enum'lar, fraud kuralları |
| `Fraudio.Application` | `FraudDetectionService`, `IFraudioDbContext` |
| `Fraudio.Infrastructure` | EF Core/PostgreSQL, Redis, RabbitMQ, Open-Meteo API |
| `Fraudio.Api` | Controller, JWT, validation, WebSocket, worker |
| `Fraudio.Mcp` | MCP server |
| `Fraudio.Tests` | Unit testleri, API testleri... |

## Frontend
`React + Vite`

| Route | Sayfa |
|---|---|
| `/login` | Giriş Ekranı  |
| `/` | Kontrol Paneli: Özet, pasta/işlem/hacim grafikleri, son işlemler, uyarı kartları |
| `/uyarilar` | Şüpheli işlemler tablosu |
| `/canli` | Tüm İşlemler |
| `/sistem` | Servis sağlık durumu |
| `/users/:userId` | Kullanıcı detayı + son 20 işlemi |
