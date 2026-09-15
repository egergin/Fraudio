using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace Fraudio.Api.Realtime;

public static class RealtimeEvents
{
    public const string TransactionReceived = "transaction.received";
    public const string TransactionApproved = "transaction.approved";
    public const string TransactionSuspicious = "transaction.suspicious";
    public const string SystemStatus = "system.status";
}

public sealed class WebSocketConnectionManager
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly ConcurrentDictionary<string, (WebSocket Socket, string Role)> _connections = new();
    private readonly ILogger<WebSocketConnectionManager> _logger;

    public WebSocketConnectionManager(ILogger<WebSocketConnectionManager> logger)
    {
        _logger = logger;
    }

    public int Count => _connections.Count;

    public string Add(WebSocket socket, string role)
    {
        var id = Guid.NewGuid().ToString("N");
        _connections[id] = (socket, role);
        return id;
    }

    public void Remove(string id) => _connections.TryRemove(id, out _);

    public async Task BroadcastAsync(object payload, bool adminOnly, CancellationToken ct = default)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, Json));
        foreach (var (id, (socket, role)) in _connections.ToArray())
        {
            if (adminOnly && !string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (socket.State != WebSocketState.Open)
            {
                _connections.TryRemove(id, out _);
                continue;
            }

            try
            {
                await socket.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, ct);
            }
            catch (Exception ex) when (ex is WebSocketException or OperationCanceledException)
            {
                _logger.LogDebug(ex, "Dropping dead WebSocket connection {ConnectionId}", id);
                _connections.TryRemove(id, out _);
            }
        }
    }
}
