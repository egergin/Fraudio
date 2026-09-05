namespace Fraudio.Domain;

public sealed record TransactionSnapshot(decimal Amount, double Latitude, double Longitude, DateTime OccurredAt);
public sealed record FraudEvaluation(bool VelocityTriggered, bool AmountTriggered, bool LocationTriggered)
{
    public TransactionStatus Status => TriggeredRuleCount >= 2 ? TransactionStatus.Suspicious : TransactionStatus.Approved;
    public int TriggeredRuleCount => (VelocityTriggered ? 1 : 0) + (AmountTriggered ? 1 : 0) + (LocationTriggered ? 1 : 0);
}

public static class FraudRules
{
    public static bool IsVelocityTriggered(int transactionsInLastMinuteIncludingCurrent) => transactionsInLastMinuteIncludingCurrent > 5;

    public static bool IsAmountTriggered(decimal currentAmount, IReadOnlyCollection<decimal> previous24HourAmounts)
        => previous24HourAmounts.Count > 0 && currentAmount > previous24HourAmounts.Average() * 3;

    public static bool IsLocationTriggered(TransactionSnapshot? previous, TransactionSnapshot current)
    {
        if (previous is null || current.OccurredAt <= previous.OccurredAt) return false;
        if (previous.Latitude == 0 && previous.Longitude == 0) return false;
        if (current.Latitude == 0 && current.Longitude == 0) return false;
        var distance = HaversineKilometres(previous.Latitude, previous.Longitude, current.Latitude, current.Longitude);
        var requiredHours = distance / 800d;
        return current.OccurredAt - previous.OccurredAt < TimeSpan.FromHours(requiredHours);
    }

    private static double HaversineKilometres(double lat1, double lon1, double lat2, double lon2)
    {
        const double radius = 6371d;
        var dLat = ToRadians(lat2 - lat1); var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return radius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
    private static double ToRadians(double value) => value * Math.PI / 180d;
}
