using System.Text.Json;
using Fraudio.Application;
using RabbitMQ.Client;

namespace Fraudio.Infrastructure.Messaging;

public sealed class RabbitMqTransactionPublisher(IConnection connection) : ITransactionMessagePublisher
{
    public async Task PublishAsync(TransactionReceived transaction, CancellationToken cancellationToken)
    {
        await using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
        var body = JsonSerializer.SerializeToUtf8Bytes(transaction);
        await channel.BasicPublishAsync("fraud-platform.exchange", "transaction.received", body, cancellationToken);
    }
}
