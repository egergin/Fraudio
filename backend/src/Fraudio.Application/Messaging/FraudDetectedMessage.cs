namespace Fraudio.Application.Messaging;

public sealed record FraudDetectedMessage(
    Guid TransactionId,
    string UserId,
    string Status,
    IReadOnlyList<string> TriggeredRules,
    DateTime OccurredAt);
