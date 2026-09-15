using System.Text.Json;
using Fraudio.Application.Geolocation;
using Fraudio.Application.State;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Fraudio.Infrastructure.Geolocation;

public sealed class OpenMeteoGeolocationService : IGeolocationService
{
    private const int MaxAttempts = 2;
    private readonly HttpClient _http;
    private readonly IGeoCache _cache;
    private readonly GeolocationOptions _options;
    private readonly ILogger<OpenMeteoGeolocationService> _logger;

    public OpenMeteoGeolocationService(
        HttpClient http,
        IGeoCache cache,
        IOptions<GeolocationOptions> options,
        ILogger<OpenMeteoGeolocationService> logger)
    {
        _http = http;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<GeoCoords?> ResolveAsync(string city, CancellationToken cancellationToken = default)
    {
        var normalized = city.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var cached = await TryCacheAsync(normalized, cancellationToken);
        if (cached is not null)
        {
            _logger.LogDebug("GeolocationCacheHit {City}", normalized);
            return cached;
        }

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                var resolved = await QueryProviderAsync(normalized, cancellationToken);
                if (resolved is not null)
                {
                    await TryCacheSetAsync(normalized, resolved, cancellationToken);
                    _logger.LogInformation(
                        "GeolocationResolved {City} {Latitude} {Longitude}",
                        resolved.City, resolved.Latitude, resolved.Longitude);
                    return resolved;
                }
                
                _logger.LogWarning("GeolocationError {City} {Reason}", normalized, "city not found");
                return null;
            }
            catch (HttpRequestException ex) when (attempt < MaxAttempts)
            {
                _logger.LogWarning(ex, "GeolocationError {City} {Reason}, retrying", normalized, "transient failure");
                await Task.Delay(TimeSpan.FromMilliseconds(300 * attempt), cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                _logger.LogError(ex, "GeolocationError {City} {Reason}", normalized, "provider unavailable");
                return null;
            }
        }

        return null;
    }

    private async Task<GeoCoords?> TryCacheAsync(string city, CancellationToken ct)
    {
        try
        {
            return await _cache.GetAsync(city, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RedisError geolocation cache read {City}", city);
            return null;
        }
    }

    private async Task TryCacheSetAsync(string city, GeoCoords coords, CancellationToken ct)
    {
        try
        {
            await _cache.SetAsync(city, coords, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RedisError geolocation cache write {City}", city);
        }
    }

    private async Task<GeoCoords?> QueryProviderAsync(string city, CancellationToken ct)
    {
        var url = $"{_options.BaseUrl.TrimEnd('/')}/v1/search" +
                  $"?name={Uri.EscapeDataString(city)}&count=1&language=en&format=json";
        using var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        if (!doc.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
        {
            return null;
        }

        var first = results[0];
        string? country = null;
        if (first.TryGetProperty("country", out var countryProp))
        {
            country = countryProp.GetString();
        }

        return new GeoCoords(
            first.GetProperty("latitude").GetDouble(),
            first.GetProperty("longitude").GetDouble(),
            first.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? city : city,
            country);
    }
}
