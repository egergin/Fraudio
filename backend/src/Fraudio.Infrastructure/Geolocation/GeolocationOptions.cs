namespace Fraudio.Infrastructure.Geolocation;

public sealed class GeolocationOptions
{
    public const string SectionName = "Geolocation";

    public string BaseUrl { get; set; } = "https://geocoding-api.open-meteo.com";
}
