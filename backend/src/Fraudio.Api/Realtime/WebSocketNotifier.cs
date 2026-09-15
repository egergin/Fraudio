using Fraudio.Application.Fraud;
using Fraudio.Application.Realtime;

namespace Fraudio.Api.Realtime;

public sealed class WebSocketNotifier : IRealtimeNotifier
{
    private readonly WebSocketConnectionManager _manager;
    private readonly ILogger<WebSocketNotifier> _logger;

    public WebSocketNotifier(WebSocketConnectionManager manager, ILogger<WebSocketNotifier> logger)
    {
        _manager = manager;
        _logger = logger;
    }

    public Task TransactionReceivedAsync(
        Guid transactionId, string userId, decimal amount, string? city, DateTime occurredAt,
        CancellationToken cancellationToken = default) =>
        TryBroadcastAsync(new
        {
            Event = RealtimeEvents.TransactionReceived,
            TransactionId = transactionId,
            UserId = userId,
            Amount = amount,
            City = city,
            OccurredAt = occurredAt
        }, adminOnly: false, cancellationToken);

    public Task FraudProcessedAsync(
        FraudOutcome outcome, string userId, decimal amount, string? city, DateTime occurredAt,
        CancellationToken cancellationToken = default) =>
        TryBroadcastAsync(new
        {
            Event = outcome.Status.ToString() == "Suspicious"
                ? RealtimeEvents.TransactionSuspicious
                : RealtimeEvents.TransactionApproved,
            TransactionId = outcome.TransactionId,
            UserId = userId,
            Amount = amount,
            City = city,
            Status = outcome.Status.ToString(),
            TriggeredRules = outcome.TriggeredRules,
            OccurredAt = occurredAt
        }, adminOnly: false, cancellationToken);

    public Task SystemStatusAsync(string status, IDictionary<string, string> dependencies,
        CancellationToken cancellationToken = default) =>
        TryBroadcastAsync(new
        {
            Event = RealtimeEvents.SystemStatus,
            Status = status,
            Dependencies = dependencies,
            Timestamp = DateTime.UtcNow
        }, adminOnly: true, cancellationToken);

    private async Task TryBroadcastAsync(object payload, bool adminOnly, CancellationToken ct)
    {
        try
        {
            await _manager.BroadcastAsync(payload, adminOnly, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Realtime broadcast failed (best-effort)");
        }
    }
}
