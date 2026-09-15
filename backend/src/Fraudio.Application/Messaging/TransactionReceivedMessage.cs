namespace Fraudio.Application.Messaging;

public sealed record TransactionReceivedMessage(
    Guid TransactionId,
    string UserId,
    decimal Amount,
    double? Latitude,
    double? Longitude,
    string? City,
    string? Country,
    DateTime OccurredAt);
