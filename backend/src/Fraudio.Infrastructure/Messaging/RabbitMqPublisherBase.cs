using System.Text;
using System.Text.Json;
using Fraudio.Application.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace Fraudio.Infrastructure.Messaging;

public abstract class RabbitMqPublisherBase
{
    private readonly RabbitMqConnectionProvider _provider;
    private readonly string _exchange;
    private readonly ILogger _logger;

    protected RabbitMqPublisherBase(
        RabbitMqConnectionProvider provider,
        IOptions<RabbitMqOptions> options,
        ILogger logger)
    {
        _provider = provider;
        _exchange = options.Value.Exchange;
        _logger = logger;
    }

    protected async Task PublishAsync<T>(
        T message,
        string routingKey,
        IDictionary<string, object?>? headers,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var channel = await _provider.CreateChannelAsync(cancellationToken);
            var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message, MessagingJson.Options));
            var properties = new BasicProperties
            {
                Persistent = true,
                Headers = headers
            };
            await channel.BasicPublishAsync(_exchange, routingKey, false, properties, body, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RabbitMQError publishing to {RoutingKey}", routingKey);
            throw;
        }
    }

    protected Task PublishAsync<T>(T message, string routingKey, CancellationToken cancellationToken) =>
        PublishAsync(message, routingKey, headers: null, cancellationToken);
}
