namespace Fraudio.Application.Geolocation;

public sealed record GeoCoords(double Latitude, double Longitude, string City, string? Country);

public interface IGeolocationService
{
    Task<GeoCoords?> ResolveAsync(string city, CancellationToken cancellationToken = default);
}
