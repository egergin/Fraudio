namespace Fraudio.Application.Messaging;

public interface ITransactionPublisher
{
    Task PublishAsync(TransactionReceivedMessage message, CancellationToken cancellationToken = default);
}

public interface IFraudEventPublisher
{
    Task PublishAsync(FraudDetectedMessage message, CancellationToken cancellationToken = default);
}
