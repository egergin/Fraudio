namespace Fraudio.Api.Models;

public sealed record TransactionItemResponse(
    Guid TransactionId,
    decimal Amount,
    string? City,
    string Status,
    IReadOnlyList<string> TriggeredRules,
    DateTime OccurredAt);

public sealed record TransactionUserDetailResponse(
    string UserId,
    int TotalTransactions,
    int SuspiciousTransactions,
    TransactionItemResponse? LastTransaction);

public sealed record FraudItemResponse(
    Guid TransactionId,
    string UserId,
    decimal Amount,
    string? City,
    string Status,
    IReadOnlyList<string> TriggeredRules,
    DateTime OccurredAt);

public sealed record ApplicationUserItemResponse(
    Guid Id,
    string Username,
    string Email,
    string Role,
    DateTime CreatedAt);

public sealed record HealthResponse(
    string Status,
    IDictionary<string, string> Dependencies);

public sealed record DashboardSummaryResponse(
    int TotalTransactions,
    int SuspiciousTransactions,
    int TotalUsers,
    int SuspiciousUsers,
    decimal TotalVolume,
    decimal SuspiciousVolume);

public sealed record SeriesPointResponse(
    DateTime Start,
    int Total,
    int Suspicious,
    decimal Volume,
    decimal SuspiciousVolume);
