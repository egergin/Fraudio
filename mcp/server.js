import express from 'express';

const app = express();
app.use(express.json());

const backendUrl = process.env.BACKEND_URL || 'http://backend:8080';
const username = process.env.MCP_USERNAME || 'admin';
const password = process.env.MCP_PASSWORD || 'replace-admin-password';

async function getAdminToken() {
  const res = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Backend kimlik doğrulaması başarısız oldu (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.accessToken;
}

const tools = [
  {
    name: 'get_recent_frauds',
    description: 'Platform tarafından tespit edilen en son şüpheli işlemleri döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Döndürülecek maksimum şüpheli işlem sayısı (varsayılan: 20)'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'check_user_status',
    description: 'Belirli bir kullanıcı için işlem özeti, şüpheli sayısı ve son aktiviteleri döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'İncelenecek dış kullanıcı kimliği'
        }
      },
      required: ['userId'],
      additionalProperties: false
    }
  }
];

app.post('/mcp', async (req, res) => {
  const { id, method, params = {} } = req.body || {};

  try {
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'fraudio-mcp',
            version: '1.0.0'
          }
        }
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { tools }
      });
    }

    if (method === 'tools/call') {
      const toolName = params.name;
      const toolArgs = params.arguments || {};

      let endpointPath;
      if (toolName === 'get_recent_frauds') {
        endpointPath = '/api/frauds/recent';
      } else if (toolName === 'check_user_status') {
        if (!toolArgs.userId) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Gerekli parametre eksik: userId' }
          });
        }
        endpointPath = `/api/transaction-users/${encodeURIComponent(toolArgs.userId)}`;
      } else {
        return res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Bilinmeyen araç: ${toolName}` }
        });
      }

      const token = await getAdminToken();
      const backendRes = await fetch(`${backendUrl}${endpointPath}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const responseBody = await backendRes.json();
      if (!backendRes.ok) {
        throw new Error(responseBody.message || `Backend ${backendRes.status} durum kodu döndürdü`);
      }

      let result = responseBody;
      if (toolName === 'get_recent_frauds' && toolArgs.limit && Array.isArray(responseBody)) {
        result = responseBody.slice(0, toolArgs.limit);
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      });
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Metod bulunamadı: ${method}` }
    });
  } catch (error) {
    return res.json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32000, message: error.message }
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`MCP Sunucusu ${port} portunda çalışıyor`);
});
