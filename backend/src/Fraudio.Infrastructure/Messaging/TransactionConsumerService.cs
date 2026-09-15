using System.Text;
using System.Text.Json;
using Fraudio.Application.Fraud;
using Fraudio.Application.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Fraudio.Infrastructure.Messaging;

public sealed class TransactionConsumerService : BackgroundService
{
    private readonly RabbitMqConnectionProvider _provider;
    private readonly IServiceScopeFactory _scopes;
    private readonly string _exchange;
    private readonly ILogger<TransactionConsumerService> _logger;

    public TransactionConsumerService(
        RabbitMqConnectionProvider provider,
        IServiceScopeFactory scopes,
        IOptions<RabbitMqOptions> options,
        ILogger<TransactionConsumerService> logger)
    {
        _provider = provider;
        _scopes = scopes;
        _exchange = options.Value.Exchange;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var channel = await _provider.CreateChannelAsync(stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (sender, ea) => HandleAsync(channel, ea, stoppingToken);

        await channel.BasicConsumeAsync(
            RabbitMqNames.TransactionQueue, autoAck: false, consumer, stoppingToken);
        _logger.LogInformation("Consuming {Queue}", RabbitMqNames.TransactionQueue);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            await channel.CloseAsync(stoppingToken);
        }
    }

    private async Task HandleAsync(IChannel channel, BasicDeliverEventArgs ea, CancellationToken ct)
    {
        TransactionReceivedMessage? message;
        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            message = JsonSerializer.Deserialize<TransactionReceivedMessage>(json, MessagingJson.Options);
            if (message is null)
            {
                throw new JsonException("Null payload.");
            }
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "RabbitMQError poison message, moving to {Dlq}", RabbitMqNames.TransactionDlq);
            await MoveToDlqAsync(channel, ea, RabbitMqNames.TransactionDlq, ct);
            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: ct);
            return;
        }

        try
        {
            await ProcessAsync(message, ct);
            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "RabbitMQError processing {TransactionId}", message.TransactionId);
            var retryCount = MessageRetry.GetRetryCount(ea.BasicProperties?.Headers);
            if (MessageRetry.ShouldRetry(retryCount))
            {
                var headers = MessageRetry.NextHeaders(ea.BasicProperties?.Headers);
                var body = ea.Body.ToArray();
                var properties = new BasicProperties { Persistent = true, Headers = headers };
                await channel.BasicPublishAsync(
                    _exchange, RabbitMqNames.TransactionReceivedKey, false, properties, body, ct);
                _logger.LogWarning(
                    "Retrying {TransactionId} attempt {Attempt}", message.TransactionId, retryCount + 1);
            }
            else
            {
                _logger.LogWarning(
                    "Max retries exceeded for {TransactionId}, moving to {Dlq}",
                    message.TransactionId, RabbitMqNames.TransactionDlq);
                await MoveToDlqAsync(channel, ea, RabbitMqNames.TransactionDlq, ct);
            }

            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: ct);
        }
    }
    
    private async Task ProcessAsync(TransactionReceivedMessage message, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var fraud = scope.ServiceProvider.GetRequiredService<IFraudDetectionService>();
        await fraud.ProcessAsync(message, ct);
    }

    private async Task MoveToDlqAsync(IChannel channel, BasicDeliverEventArgs ea, string dlq, CancellationToken ct)
    {
        var properties = new BasicProperties { Persistent = true, Headers = ea.BasicProperties?.Headers };
        await channel.BasicPublishAsync("", dlq, false, properties, ea.Body.ToArray(), ct);
    }
}
