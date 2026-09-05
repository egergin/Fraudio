using System.Text.Json;
using Fraudio.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Fraudio.Infrastructure.Messaging;

public sealed class TransactionWorker(IConnection connection, IServiceScopeFactory scopes, IRealtimeNotifier realtime, ILogger<TransactionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, message) =>
        {
            try
            {
                var transaction = JsonSerializer.Deserialize<TransactionReceived>(message.Body.Span) ?? throw new InvalidOperationException("Invalid transaction message.");
                using var scope = scopes.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<ITransactionProcessor>();
                var processed = await processor.ProcessAsync(transaction, stoppingToken);
                if (processed is not null)
                {
                    var rules = new[] { processed.Evaluation.VelocityTriggered ? "Velocity" : null, processed.Evaluation.AmountTriggered ? "Amount" : null, processed.Evaluation.LocationTriggered ? "Location" : null }.Where(x => x is not null).ToArray();
                    var notification = JsonSerializer.SerializeToUtf8Bytes(new { transactionId = transaction.TransactionId, userId = transaction.UserId, amount = transaction.Amount, city = transaction.City, status = processed.Evaluation.Status.ToString(), triggeredRules = rules, occurredAt = transaction.OccurredAt });
                    await channel.BasicPublishAsync("fraud-platform.exchange", "fraud.detected", notification, stoppingToken);
                    await realtime.PublishAsync(new { eventType = processed.Evaluation.Status == Fraudio.Domain.TransactionStatus.Suspicious ? "transaction.suspicious" : "transaction.approved", transactionId = transaction.TransactionId, userId = transaction.UserId, amount = transaction.Amount, city = transaction.City, status = processed.Evaluation.Status.ToString(), triggeredRules = rules, occurredAt = transaction.OccurredAt }, stoppingToken);
                }
                await channel.BasicAckAsync(message.DeliveryTag, false, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Transaction processing failed");
                var attempts = GetAttempts(message.BasicProperties.Headers);
                if (attempts < 3)
                {
                    var properties = new BasicProperties { Headers = new Dictionary<string, object?> { ["x-retry-count"] = attempts + 1 } };
                    await channel.BasicPublishAsync("fraud-platform.exchange", "transaction.received", false, properties, message.Body, stoppingToken);
                    await channel.BasicAckAsync(message.DeliveryTag, false, stoppingToken);
                }
                else await channel.BasicNackAsync(message.DeliveryTag, false, false, stoppingToken);
            }
        };
        await channel.BasicConsumeAsync("transaction.queue", false, consumer, stoppingToken);
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    private static int GetAttempts(IDictionary<string, object?>? headers) => headers is not null && headers.TryGetValue("x-retry-count", out var value) ? value switch { int i => i, long l => (int)l, byte[] b when int.TryParse(System.Text.Encoding.UTF8.GetString(b), out var n) => n, _ => 0 } : 0;
}
