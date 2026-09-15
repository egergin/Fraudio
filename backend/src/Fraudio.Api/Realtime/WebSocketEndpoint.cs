using System.Net.WebSockets;
using System.Security.Claims;

namespace Fraudio.Api.Realtime;

public static class WebSocketEndpoint
{
    public static void MapWebSocketEndpoint(this WebApplication app)
    {
        app.MapGet("/ws", async (
            HttpContext context,
            WebSocketConnectionManager manager,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                return Results.BadRequest("WebSocket request expected.");
            }

            var logger = loggerFactory.CreateLogger("WebSocketEndpoint");
            var role = context.User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
            var username = context.User.Identity?.Name
                ?? context.User.FindFirst("unique_name")?.Value ?? "?";

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            var id = manager.Add(socket, role);
            logger.LogInformation("WebSocket connected {Username} {Role}", username, role);

            var buffer = new byte[4096];
            try
            {
                while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
                {
                    var result = await socket.ReceiveAsync(buffer, ct);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (WebSocketException ex)
            {
                logger.LogDebug(ex, "WebSocket connection {ConnectionId} dropped", id);
            }
            finally
            {
                manager.Remove(id);
                logger.LogInformation("WebSocket disconnected {Username}", username);
                if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                {
                    try
                    {
                        await socket.CloseAsync(
                            WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                    }
                    catch (WebSocketException)
                    {
                    }
                }
            }

            return Results.Empty;
        }).RequireAuthorization();
    }
}

public sealed class SystemStatusBroadcastService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(15);
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<SystemStatusBroadcastService> _logger;

    public SystemStatusBroadcastService(IServiceScopeFactory scopes, ILogger<SystemStatusBroadcastService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var health = scope.ServiceProvider.GetRequiredService<Services.ISystemHealthService>();
                var notifier = scope.ServiceProvider.GetRequiredService<WebSocketNotifier>();
                var response = await health.CheckAsync(stoppingToken);
                await notifier.SystemStatusAsync(response.Status, response.Dependencies, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "system.status broadcast failed (best-effort)");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
