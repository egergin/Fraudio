using System.Text.Json;
using Fraudio.Application;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Fraudio.Infrastructure.Geolocation;

public sealed class CachedGeolocationService(
    IGeolocationService innerService,
    IConnectionMultiplexer redis,
    ILogger<CachedGeolocationService> logger) : IGeolocationService
{
    private readonly IDatabase _database = redis.GetDatabase();
    private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(7);

    public async Task<Fraudio.Application.Geolocation?> ResolveAsync(string location, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(location)) return null;

        var cacheKey = $"cache:geo:{location.Trim().ToLowerInvariant()}";
        try
        {
            var cachedJson = await _database.StringGetAsync(cacheKey);
            if (cachedJson.HasValue)
            {
                var cached = JsonSerializer.Deserialize<Fraudio.Application.Geolocation>(cachedJson.ToString());
                if (cached is not null)
                {
                    logger.LogDebug("Geolocation cache hit for {Location}", location);
                    return cached;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to read geolocation from Redis cache for {Location}", location);
        }

        try
        {
            var resolved = await innerService.ResolveAsync(location, cancellationToken);
            if (resolved is not null)
            {
                try
                {
                    var json = JsonSerializer.Serialize(resolved);
                    await _database.StringSetAsync(cacheKey, json, CacheTtl);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to write geolocation to Redis cache for {Location}", location);
                }
            }
            return resolved;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error resolving geolocation for {Location}", location);
            return null;
        }
    }
}
