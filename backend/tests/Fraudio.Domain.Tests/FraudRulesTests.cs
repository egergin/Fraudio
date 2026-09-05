using Fraudio.Domain;

namespace Fraudio.Domain.Tests;

public sealed class FraudRulesTests
{
    [Fact] public void Velocity_does_not_trigger_on_five_transactions() => Assert.False(FraudRules.IsVelocityTriggered(5));
    [Fact] public void Velocity_triggers_on_sixth_transaction() => Assert.True(FraudRules.IsVelocityTriggered(6));
    [Fact] public void Amount_triggers_above_three_times_average() => Assert.True(FraudRules.IsAmountTriggered(301m, [100m, 100m]));
    [Fact] public void Impossible_travel_triggers_location_rule()
    {
        var previous = new TransactionSnapshot(10m, 41.0082, 28.9784, DateTime.UtcNow);
        var current = new TransactionSnapshot(10m, 40.7128, -74.0060, previous.OccurredAt.AddHours(1));
        Assert.True(FraudRules.IsLocationTriggered(previous, current));
    }
    [Theory]
    [InlineData(false, false, false, TransactionStatus.Approved)]
    [InlineData(true, false, false, TransactionStatus.Approved)]
    [InlineData(true, true, false, TransactionStatus.Suspicious)]
    [InlineData(true, true, true, TransactionStatus.Suspicious)]
    public void Final_status_requires_two_rules(bool velocity, bool amount, bool location, TransactionStatus expected) => Assert.Equal(expected, new FraudEvaluation(velocity, amount, location).Status);
}
