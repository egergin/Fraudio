using Fraudio.Application.Fraud;

namespace Fraudio.Application.Realtime;

public interface IRealtimeNotifier
{
    Task TransactionReceivedAsync(
        Guid transactionId, string userId, decimal amount, string? city, DateTime occurredAt,
        CancellationToken cancellationToken = default);

    Task FraudProcessedAsync(
        FraudOutcome outcome, string userId, decimal amount, string? city, DateTime occurredAt,
        CancellationToken cancellationToken = default);
}
