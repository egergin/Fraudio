# REST API ve WebSocket Referansı

Tüm yanıtlar standart JSON döndürür. Hatalar `{ "code": "...", "message": "..." }` biçimini takip eder.

---

## Kimlik Doğrulama

### `POST /api/auth/login`
JWT Bearer token almak için açık uç nokta.

* **İstek:**
```json
{
  "username": "admin",
  "password": "replace-admin-password"
}
```
* **Yanıt (200 OK):**
```json
{
  "accessToken": "ey...",
  "expiresAt": "2026-09-05T18:00:00Z",
  "role": "Admin"
}
```

---

## İşlemler

### `POST /api/transactions`
* **Yetkilendirme:** `Admin`
* **İstek:**
```json
{
  "userId": "customer-100",
  "amount": 1250.50,
  "location": "Istanbul"
}
```
* **Yanıt (202 Accepted):**
```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Accepted"
}
```

---

## Sorgular

### `GET /api/transaction-users/{userId}`
* **Yetkilendirme:** `Admin`, `Analyst`
* **Yanıt (200 OK):**
```json
{
  "userId": "customer-100",
  "totalTransactions": 14,
  "suspiciousTransactions": 2,
  "lastTransaction": {
    "id": "550e8400-...",
    "amount": 1250.50,
    "city": "Istanbul",
    "status": "Suspicious",
    "occurredAt": "2026-09-05T09:30:00Z"
  }
}
```

### `GET /api/transaction-users/{userId}/transactions`
* **Yetkilendirme:** `Admin`, `Analyst`
* **Yanıt (200 OK):** Belirtilen kullanıcı için en son 20 işlemden oluşan dizi.

### `GET /api/frauds/recent`
* **Yetkilendirme:** `Admin`, `Analyst`
* **Yanıt (200 OK):** En son 20 şüpheli işlemden oluşan dizi.

---

## Sistem Sağlığı

### `GET /api/system/health`
* **Yetkilendirme:** `Admin`
* **Yanıt (200 OK / 503 Service Unavailable):**
```json
{
  "postgreSql": "Healthy",
  "redis": "Healthy",
  "rabbitMq": "Healthy"
}
```

---

## Gerçek Zamanlı WebSocket (`/ws`)
* **URL:** `ws://localhost:8080/ws?access_token=<JWT>`
* **Yayınlanan Olaylar:**
  * `transaction.received`
  * `transaction.approved`
  * `transaction.suspicious`
