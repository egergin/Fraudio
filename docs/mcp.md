
# MCP Server
Agent'ların fraud verilerine erişmesi için Model Context Protocol (MCP Server).

- Endpoint: `POST http://<mcp-host>:8090/mcp`
- Backend: `Mcp:BackendBaseUrl`
- Kimlik: `Mcp:BackendUsername` / `Mcp:BackendPassword`

## Tool'lar
### `get_recent_frauds`

Son şüpheli transaction'ları getirir<br>
`GET /api/frauds/recent`.

`limit` ─▶ opsiyonel:
```json
{ "limit": 5 }
```

Output:

```json
[
  {
    "transactionId": "uuid",
    "userId": "user-123",
    "amount": 5000.00,
    "city": "New York",
    "status": "Suspicious",
    "triggeredRules": ["Velocity", "Amount", "Location"],
    "occurredAt": "2026-09-08T11:04:58Z"
  }
]
```

### `check_user_status`
Kullanıcının fraud geçmişini getirir.<br>
`GET /api/transaction-users/{userId}`.

Input (`userId` zorunlu):
```json
{ "userId": "user-123" }
```
Output:
```json
{
  "userId": "user-123",
  "totalTransactions": 7,
  "suspiciousTransactions": 1,
  "lastTransaction": { "...": "..." }
}
```
NOT FOUND:
```json
{ "code": "USER_NOT_FOUND", "message": "Transaction user not found." }
```

## cURL ile Test
```bash
M=http://localhost:8090/mcp
H=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")
curl "${H[@]}" -X POST $M -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' | grep '^data:'
curl "${H[@]}" -X POST $M -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | grep '^data:'
curl "${H[@]}" -X POST $M -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_recent_frauds","arguments":{"limit":5}}}' | grep '^data:'
```
