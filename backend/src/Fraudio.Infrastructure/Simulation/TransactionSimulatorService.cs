using Fraudio.Application.Geolocation;
using Fraudio.Application.Messaging;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Fraudio.Infrastructure.Simulation;

public sealed class TransactionSimulatorService : BackgroundService
{
    private static readonly string[] PoolUsers =
        ["user-01", "user-02", "user-03", "user-04", "user-05", "user-06",
         "user-07", "user-08", "user-09", "user-10", "user-11", "user-12"];

    private static readonly string[] HomeCities =
        ["Istanbul", "Istanbul", "Istanbul", "Ankara", "Ankara", "Izmir", "Bursa", "Adana", "Konya"];

    private static readonly string[] FarCities = ["New York", "Tokyo", "Sydney", "Sao Paulo", "London"];

    private readonly ITransactionPublisher _publisher;
    private readonly IGeolocationService _geolocation;
    private readonly TransactionSimulatorOptions _options;
    private readonly ILogger<TransactionSimulatorService> _logger;
    private int _episodeCounter;

    public TransactionSimulatorService(
        ITransactionPublisher publisher,
        IGeolocationService geolocation,
        IOptions<TransactionSimulatorOptions> options,
        ILogger<TransactionSimulatorService> logger)
    {
        _publisher = publisher;
        _geolocation = geolocation;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Transaction simulator disabled (Simulator:Enabled=false).");
            return;
        }

        _logger.LogInformation(
            "Transaction simulator started (first run in {Initial} min, then every {Min}-{Max} min).",
            _options.InitialDelayMinutes, _options.MinDelayMinutes, _options.MaxDelayMinutes);

        await Task.Delay(TimeSpan.FromMinutes(_options.InitialDelayMinutes), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (Random.Shared.NextDouble() < _options.SuspiciousProbability)
                {
                    await RunSuspiciousEpisodeAsync(stoppingToken);
                }
                else
                {
                    await PublishOneAsync(
                        PoolUsers[Random.Shared.Next(PoolUsers.Length)],
                        RandomAmount(),
                        HomeCities[Random.Shared.Next(HomeCities.Length)],
                        stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Transaction simulator cycle failed; will retry next round.");
            }

            var next = NextDelay();
            _logger.LogInformation("Transaction simulator: next transaction in {Delay}.", next);
            try
            {
                await Task.Delay(next, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task RunSuspiciousEpisodeAsync(CancellationToken ct)
    {
        var user = $"user-{Interlocked.Increment(ref _episodeCounter):D3}";
        for (var i = 0; i < 6; i++)
        {
            await PublishOneAsync(user, 80m + Random.Shared.Next(0, 40), "Istanbul", ct);
        }

        await PublishOneAsync(
            user,
            4000m + Random.Shared.Next(0, 2000),
            FarCities[Random.Shared.Next(FarCities.Length)],
            ct);
        _logger.LogInformation("Transaction simulator: suspicious episode published for {UserId}.", user);
    }

    private async Task PublishOneAsync(string userId, decimal amount, string city, CancellationToken ct)
    {
        var coords = await _geolocation.ResolveAsync(city, ct);
        var message = new TransactionReceivedMessage(
            Guid.NewGuid(),
            userId,
            amount,
            coords?.Latitude,
            coords?.Longitude,
            coords?.City ?? city,
            coords?.Country,
            OccurredAt: DateTime.UtcNow);

        await _publisher.PublishAsync(message, ct);
        _logger.LogInformation(
            "Transaction simulator: new transaction created {TransactionId} {UserId} {Amount} {City}.",
            message.TransactionId, userId, amount, message.City);
    }
    
    public static decimal RandomAmount()
    {
        var roll = Random.Shared.NextDouble();
        var value = roll switch
        {
            < 0.7 => 10 + Random.Shared.NextDouble() * 190,
            < 0.9 => 200 + Random.Shared.NextDouble() * 600,
            _ => 800 + Random.Shared.NextDouble() * 4200
        };
        return Math.Round((decimal)value, 2);
    }

    public TimeSpan NextDelay()
    {
        var minutes = _options.MinDelayMinutes
            + Random.Shared.NextDouble() * (_options.MaxDelayMinutes - _options.MinDelayMinutes);
        return TimeSpan.FromMinutes(minutes);
    }
}
