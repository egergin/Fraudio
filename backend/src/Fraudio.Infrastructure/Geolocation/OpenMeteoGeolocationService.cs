using System.Text.Json;
using Fraudio.Application;

namespace Fraudio.Infrastructure.Geolocation;

public sealed class OpenMeteoGeolocationService(HttpClient client) : IGeolocationService
{
    public async Task<Fraudio.Application.Geolocation?> ResolveAsync(string location, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync($"v1/search?name={Uri.EscapeDataString(location)}&count=1&language=en&format=json", cancellationToken);
        if (!response.IsSuccessStatusCode) return null;
        using var document = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
        if (!document.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0) return null;
        var item = results[0];
        return new Fraudio.Application.Geolocation(item.GetProperty("latitude").GetDouble(), item.GetProperty("longitude").GetDouble(), item.GetProperty("name").GetString()!, item.TryGetProperty("country", out var country) ? country.GetString() ?? "Unknown" : "Unknown");
    }
}
