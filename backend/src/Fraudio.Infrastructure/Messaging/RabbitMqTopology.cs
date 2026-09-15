using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace Fraudio.Infrastructure.Messaging;

public static class RabbitMqTopology
{
    public static async Task DeclareAsync(IChannel channel, string exchange, CancellationToken ct)
    {
        await channel.ExchangeDeclareAsync(exchange, ExchangeType.Direct, durable: true, cancellationToken: ct);

        await DeclareQueueAsync(channel, RabbitMqNames.TransactionQueue, ct);
        await DeclareQueueAsync(channel, RabbitMqNames.NotificationQueue, ct);
        await DeclareQueueAsync(channel, RabbitMqNames.TransactionDlq, ct);
        await DeclareQueueAsync(channel, RabbitMqNames.NotificationDlq, ct);

        await channel.QueueBindAsync(RabbitMqNames.TransactionQueue, exchange, RabbitMqNames.TransactionReceivedKey, cancellationToken: ct);
        await channel.QueueBindAsync(RabbitMqNames.NotificationQueue, exchange, RabbitMqNames.FraudDetectedKey, cancellationToken: ct);
    }

    private static Task DeclareQueueAsync(IChannel channel, string queue, CancellationToken ct) =>
        channel.QueueDeclareAsync(queue, durable: true, exclusive: false, autoDelete: false, cancellationToken: ct);
}

public sealed class RabbitMqSetupService : IHostedService
{
    private readonly RabbitMqConnectionProvider _provider;
    private readonly IOptions<RabbitMqOptions> _options;
    private readonly ILogger<RabbitMqSetupService> _logger;

    public RabbitMqSetupService(
        RabbitMqConnectionProvider provider,
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitMqSetupService> logger)
    {
        _provider = provider;
        _options = options;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var channel = await _provider.CreateChannelAsync(cancellationToken);
        await RabbitMqTopology.DeclareAsync(channel, _options.Value.Exchange, cancellationToken);
        _logger.LogInformation("RabbitMQ topology declared on {Exchange}", _options.Value.Exchange);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
