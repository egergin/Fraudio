using Fraudio.Application.Geolocation;

namespace Fraudio.Application.State;

public sealed record LastLocation(
    double Latitude,
    double Longitude,
    string? City,
    string? Country,
    DateTime OccurredAt);

public interface IVelocityStore
{
    Task<long> AddAndCountAsync(
        string userId, Guid transactionId, DateTime occurredAt,
        CancellationToken cancellationToken = default);
}

public interface IAmountStore
{
    Task<decimal?> GetAverageAsync(
        string userId, DateTime now, CancellationToken cancellationToken = default);

    Task RecordAsync(
        string userId, Guid transactionId, decimal amount, DateTime occurredAt,
        CancellationToken cancellationToken = default);
}

public interface ILocationStore
{
    Task<LastLocation?> GetAsync(string userId, CancellationToken cancellationToken = default);
    Task SetAsync(string userId, LastLocation location, CancellationToken cancellationToken = default);
}

public interface IGeoCache
{
    Task<GeoCoords?> GetAsync(string city, CancellationToken cancellationToken = default);
    Task SetAsync(string city, GeoCoords coords, CancellationToken cancellationToken = default);
}
