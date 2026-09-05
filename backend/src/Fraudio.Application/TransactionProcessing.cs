using Fraudio.Domain;

namespace Fraudio.Application;

public sealed record TransactionReceived(Guid TransactionId, string UserId, decimal Amount, double Latitude, double Longitude, string City, string Country, DateTime OccurredAt);
public sealed record ProcessedTransaction(TransactionReceived Input, FraudEvaluation Evaluation);
public sealed record Geolocation(double Latitude, double Longitude, string City, string Country);
public interface IGeolocationService { Task<Geolocation?> ResolveAsync(string location, CancellationToken cancellationToken); }
public interface ITransactionMessagePublisher { Task PublishAsync(TransactionReceived transaction, CancellationToken cancellationToken); }
public interface ITransactionProcessor { Task<ProcessedTransaction?> ProcessAsync(TransactionReceived transaction, CancellationToken cancellationToken); }
public interface IRealtimeNotifier { Task PublishAsync(object payload, CancellationToken cancellationToken); }

public interface IFraudStateStore
{
    Task<int> AddAndCountLastMinuteAsync(string userId, DateTime occurredAt, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<decimal>> GetAmountsLast24HoursAsync(string userId, DateTime occurredAt, CancellationToken cancellationToken);
    Task<TransactionSnapshot?> GetLastLocationAsync(string userId, CancellationToken cancellationToken);
    Task RecordProcessedAsync(TransactionReceived transaction, CancellationToken cancellationToken);
}

public sealed class FraudDetectionService(IFraudStateStore stateStore)
{
    public async Task<ProcessedTransaction> EvaluateAsync(TransactionReceived transaction, CancellationToken cancellationToken)
    {
        var previousAmounts = await stateStore.GetAmountsLast24HoursAsync(transaction.UserId, transaction.OccurredAt, cancellationToken);
        var previousLocation = await stateStore.GetLastLocationAsync(transaction.UserId, cancellationToken);
        var velocityCount = await stateStore.AddAndCountLastMinuteAsync(transaction.UserId, transaction.OccurredAt, cancellationToken);
        var current = new TransactionSnapshot(transaction.Amount, transaction.Latitude, transaction.Longitude, transaction.OccurredAt);
        var evaluation = new FraudEvaluation(
            FraudRules.IsVelocityTriggered(velocityCount),
            FraudRules.IsAmountTriggered(transaction.Amount, previousAmounts),
            FraudRules.IsLocationTriggered(previousLocation, current));
        await stateStore.RecordProcessedAsync(transaction, cancellationToken);
        return new ProcessedTransaction(transaction, evaluation);
    }
}
