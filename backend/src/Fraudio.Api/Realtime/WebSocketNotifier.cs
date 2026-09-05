using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Fraudio.Application;

namespace Fraudio.Api.Realtime;
public sealed class WebSocketNotifier : IRealtimeNotifier
{
    private readonly ConcurrentDictionary<Guid, WebSocket> _sockets = new();
    public async Task HandleAsync(WebSocket socket, CancellationToken ct)
    {
        var id = Guid.NewGuid(); _sockets[id] = socket; var buffer = new byte[32];
        try { while (socket.State == WebSocketState.Open) { var result = await socket.ReceiveAsync(buffer, ct); if (result.MessageType == WebSocketMessageType.Close) break; } }
        finally { _sockets.TryRemove(id, out _); if (socket.State != WebSocketState.Closed) await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None); }
    }
    public async Task PublishAsync(object payload, CancellationToken ct)
    {
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
        foreach (var socket in _sockets.Values.Where(x => x.State == WebSocketState.Open)) await socket.SendAsync(body, WebSocketMessageType.Text, true, ct);
    }
}
