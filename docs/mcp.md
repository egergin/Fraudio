# Model Context Protocol (MCP) Sunucusu

Platform, YZ Ajanlarının sahtekarlık telemetrisini incelemesi için özel bir MCP uç noktası sunan bir konteyner içerir.

---

## 1. Uç Nokta Detayları
* **Taşıma:** Akışlı HTTP POST
* **URL:** `http://mcp:3000/mcp` (Dahili Compose ağı)
* **Protokol:** JSON-RPC 2.0

---

## 2. Desteklenen RPC Metodları

### `initialize`
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}
```

### `tools/list`
Mevcut inceleme araçlarını listeler:
* `get_recent_frauds`
* `check_user_status`

### `tools/call`

#### Örnek 1: `get_recent_frauds`
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_recent_frauds",
    "arguments": {
      "limit": 5
    }
  }
}
```

#### Örnek 2: `check_user_status`
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "check_user_status",
    "arguments": {
      "userId": "customer-100"
    }
  }
}
```

---

## 3. Ana Makineden MCP Testi
Docker compose içinde çalışan MCP sunucusunu test etmek için:

```bash
docker compose exec mcp node -e "
fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
}).then(r => r.json()).then(console.log);
"
```
