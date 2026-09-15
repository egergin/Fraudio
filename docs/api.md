
# API

Kimlik doğrulama: JWT (`POST /api/auth/login`)<br>Roller: `Admin`, `Analyst`

| Endpoint | Kim |
|---|---|
| `POST /api/auth/login` `{username,password}` | Herkese Açık |
| `POST /api/transactions` `{userId,amount,location}` | Admin |
| `GET /api/transaction-users/{userId}` | Admin/Analyst |
| `GET /api/transactions/recent` | Admin/Analyst |
| `GET /api/transaction-users/{userId}/transactions` | Admin/Analyst |
| `GET /api/frauds/recent` | Admin/Analyst |
| `GET /api/dashboard/summary` | Admin/Analyst |
| `GET /api/dashboard/summary?from&to` | Admin/Analyst |
| `GET /api/dashboard/series?from&to&granularity=hour\day` | Admin/Analyst |
| `GET /api/admin/users` | Admin |
| `GET /api/system/health` | Admin |
| `/ws` | Admin/Analyst |

## WebSocket event'leri

| Event | Payload |
|---|---|
| `transaction.received` | id, amount, city, occurredAt |
| `transaction.approved` | status, triggeredRules |
| `transaction.suspicious` | status, triggeredRules |
| `system.status` | status, dependencies, timestamp |
