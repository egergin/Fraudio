using Fraudio.Domain.Entities;

namespace Fraudio.Api.Models;

public static class ResponseMapper
{
    public static IReadOnlyList<string> TriggeredRules(FraudResult? result)
    {
        if (result is null)
        {
            return Array.Empty<string>();
        }

        var rules = new List<string>(capacity: 3);
        if (result.VelocityTriggered)
        {
            rules.Add("Velocity");
        }

        if (result.AmountTriggered)
        {
            rules.Add("Amount");
        }

        if (result.LocationTriggered is true)
        {
            rules.Add("Location");
        }

        return rules;
    }

    public static TransactionItemResponse ToItem(Transaction transaction) =>
        new(
            transaction.Id,
            transaction.Amount,
            transaction.City,
            transaction.Status.ToString(),
            TriggeredRules(transaction.FraudResult),
            transaction.OccurredAt);

    public static FraudItemResponse ToFraudItem(Transaction transaction) =>
        new(
            transaction.Id,
            transaction.TransactionUser.ExternalUserId,
            transaction.Amount,
            transaction.City,
            transaction.Status.ToString(),
            TriggeredRules(transaction.FraudResult),
            transaction.OccurredAt);
}
