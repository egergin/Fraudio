using Fraudio.Api.Models;
using Fraudio.Infrastructure.Messaging;
using Fraudio.Infrastructure.Persistence;
using Fraudio.Infrastructure.Redis;

namespace Fraudio.Api.Services;

public interface ISystemHealthService
{
    Task<HealthResponse> CheckAsync(CancellationToken cancellationToken = default);
}

public sealed class SystemHealthService : ISystemHealthService
{
    private readonly FraudioDbContext _db;
    private readonly RedisConnectionProvider _redis;
    private readonly RabbitMqConnectionProvider _rabbit;
    private readonly ILogger<SystemHealthService> _logger;

    public SystemHealthService(
        FraudioDbContext db,
        RedisConnectionProvider redis,
        RabbitMqConnectionProvider rabbit,
        ILogger<SystemHealthService> logger)
    {
        _db = db;
        _redis = redis;
        _rabbit = rabbit;
        _logger = logger;
    }

    public async Task<HealthResponse> CheckAsync(CancellationToken cancellationToken = default)
    {
        var dependencies = new Dictionary<string, string>
        {
            ["postgres"] = await CheckPostgresAsync(cancellationToken),
            ["redis"] = await CheckRedisAsync(),
            ["rabbitmq"] = await CheckRabbitMqAsync(cancellationToken)
        };

        var status = dependencies.Values.All(v => v == "Healthy") ? "Healthy" : "Degraded";
        return new HealthResponse(status, dependencies);
    }

    private async Task<string> CheckPostgresAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await _db.Database.CanConnectAsync(cancellationToken) ? "Healthy" : "Unhealthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DatabaseError during health check");
            return "Unhealthy";
        }
    }

    private async Task<string> CheckRedisAsync()
    {
        try
        {
            var mux = await _redis.GetAsync();
            await mux.GetDatabase().PingAsync();
            return "Healthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RedisError during health check");
            return "Unhealthy";
        }
    }

    private async Task<string> CheckRabbitMqAsync(CancellationToken cancellationToken)
    {
        try
        {
            var connection = await _rabbit.GetConnectionAsync(cancellationToken);
            return connection.IsOpen ? "Healthy" : "Unhealthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RabbitMQError during health check");
            return "Unhealthy";
        }
    }
}
