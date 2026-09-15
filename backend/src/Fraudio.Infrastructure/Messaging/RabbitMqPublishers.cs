using Fraudio.Application.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Fraudio.Infrastructure.Messaging;

public sealed class RabbitMqTransactionPublisher : RabbitMqPublisherBase, ITransactionPublisher
{
    public RabbitMqTransactionPublisher(
        RabbitMqConnectionProvider provider,
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitMqTransactionPublisher> logger)
        : base(provider, options, logger)
    {
    }

    public Task PublishAsync(TransactionReceivedMessage message, CancellationToken cancellationToken = default) =>
        PublishAsync(message, RabbitMqNames.TransactionReceivedKey, cancellationToken);
}

public sealed class RabbitMqFraudEventPublisher : RabbitMqPublisherBase, IFraudEventPublisher
{
    public RabbitMqFraudEventPublisher(
        RabbitMqConnectionProvider provider,
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitMqFraudEventPublisher> logger)
        : base(provider, options, logger)
    {
    }

    public Task PublishAsync(FraudDetectedMessage message, CancellationToken cancellationToken = default) =>
        PublishAsync(message, RabbitMqNames.FraudDetectedKey, cancellationToken);
}
