using Microsoft.Extensions.Hosting;
using RabbitMQ.Client;

namespace Fraudio.Infrastructure.Messaging;

public sealed class RabbitMqTopologyService(IConnection connection) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync("fraud-platform.exchange", ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync("fraud-platform.dlx", ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync("transaction.dlq", durable: true, cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync("notification.dlq", durable: true, cancellationToken: cancellationToken);
        await channel.QueueBindAsync("transaction.dlq", "fraud-platform.dlx", "transaction.received", cancellationToken: cancellationToken);
        await channel.QueueBindAsync("notification.dlq", "fraud-platform.dlx", "fraud.detected", cancellationToken: cancellationToken);
        var transactionArgs = new Dictionary<string, object?> { ["x-dead-letter-exchange"] = "fraud-platform.dlx" };
        var notificationArgs = new Dictionary<string, object?> { ["x-dead-letter-exchange"] = "fraud-platform.dlx" };
        await channel.QueueDeclareAsync("transaction.queue", durable: true, arguments: transactionArgs, cancellationToken: cancellationToken);
        await channel.QueueDeclareAsync("notification.queue", durable: true, arguments: notificationArgs, cancellationToken: cancellationToken);
        await channel.QueueBindAsync("transaction.queue", "fraud-platform.exchange", "transaction.received", cancellationToken: cancellationToken);
        await channel.QueueBindAsync("notification.queue", "fraud-platform.exchange", "fraud.detected", cancellationToken: cancellationToken);
    }
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
