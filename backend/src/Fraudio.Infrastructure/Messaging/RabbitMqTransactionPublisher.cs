using System.Text.Json;
using Fraudio.Application;
using RabbitMQ.Client;

namespace Fraudio.Infrastructure.Messaging;

public sealed class RabbitMqTransactionPublisher(IConnection connection) : ITransactionMessagePublisher
{
    public async Task PublishAsync(
        TransactionReceived transaction,
        CancellationToken cancellationToken,
        IDictionary<string, object?>? headers = null)
    {
        await using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
        var body = JsonSerializer.SerializeToUtf8Bytes(transaction);

        // Başlık yoksa mevcut davranış birebir korunur.
        if (headers is null || headers.Count == 0)
        {
            await channel.BasicPublishAsync(
                "fraud-platform.exchange", "transaction.received", body, cancellationToken);
            return;
        }

        var properties = new BasicProperties { Headers = headers };
        await channel.BasicPublishAsync(
            "fraud-platform.exchange",
            "transaction.received",
            mandatory: false,
            basicProperties: properties,
            body: body,
            cancellationToken: cancellationToken);
    }
}
