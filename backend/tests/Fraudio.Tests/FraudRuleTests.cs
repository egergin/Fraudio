using Fraudio.Domain.Enums;
using Fraudio.Domain.Fraud;

namespace Fraudio.Tests;

public sealed class VelocityFraudRuleTests
{
    [Fact]
    public void FiveInOneMinute_DoesNotTrigger()
    {
        Assert.False(VelocityFraudRule.IsViolated(5));
    }

    [Fact]
    public void SixthInOneMinute_Triggers()
    {
        Assert.True(VelocityFraudRule.IsViolated(6));
    }
}

public sealed class AmountFraudRuleTests
{
    [Fact]
    public void AboveThreeTimesAverage_Triggers()
    {
        Assert.True(AmountFraudRule.IsViolated(300.01m, 100m));
    }

    [Fact]
    public void ExactlyThreeTimesAverage_DoesNotTrigger()
    {
        Assert.False(AmountFraudRule.IsViolated(300m, 100m));
    }

    [Fact]
    public void BelowThreeTimesAverage_DoesNotTrigger()
    {
        Assert.False(AmountFraudRule.IsViolated(299.99m, 100m));
    }

    [Fact]
    public void NoPriorHistory_DoesNotTrigger()
    {
        Assert.False(AmountFraudRule.IsViolated(1_000_000m, null));
    }
}

public sealed class LocationFraudRuleTests
{
    private static readonly GeoPoint Istanbul = new(41.0082, 28.9784);
    private static readonly GeoPoint NewYork = new(40.7128, -74.0060);
    private static readonly GeoPoint Ankara = new(39.9334, 32.8597);

    [Fact]
    public void IstanbulToNewYorkInFiveMinutes_Triggers()
    {
        var now = DateTime.UtcNow;
        Assert.True(LocationFraudRule.IsViolated(
            Istanbul, now.AddMinutes(-5), NewYork, now));
    }

    [Fact]
    public void IstanbulToAnkaraInTwoHours_DoesNotTrigger()
    {
        var now = DateTime.UtcNow;
        Assert.False(LocationFraudRule.IsViolated(
            Istanbul, now.AddHours(-2), Ankara, now));
    }

    [Fact]
    public void SamePlace_DoesNotTrigger()
    {
        var now = DateTime.UtcNow;
        Assert.False(LocationFraudRule.IsViolated(
            Istanbul, now.AddMinutes(-1), Istanbul, now));
    }

    [Fact]
    public void MissingCurrentCoords_IsNotEvaluated()
    {
        var now = DateTime.UtcNow;
        Assert.Null(LocationFraudRule.IsViolated(
            Istanbul, now.AddMinutes(-5), null, now));
    }

    [Fact]
    public void FirstTransaction_DoesNotTrigger()
    {
        var now = DateTime.UtcNow;
        Assert.False(LocationFraudRule.IsViolated(
            null, DateTime.MinValue, NewYork, now));
    }

    [Fact]
    public void DistanceSanity_IstanbulToNewYork()
    {
        var distance = LocationFraudRule.DistanceKm(Istanbul, NewYork);
        Assert.InRange(distance, 7_000, 9_000);
    }
}

public sealed class FraudDecisionTests
{
    [Theory]
    [InlineData(0, TransactionStatus.Approved)]
    [InlineData(1, TransactionStatus.Approved)]
    [InlineData(2, TransactionStatus.Suspicious)]
    [InlineData(3, TransactionStatus.Suspicious)]
    public void ViolatedCount_MapsToExpectedStatus(int violated, TransactionStatus expected)
    {
        Assert.Equal(expected, FraudDecision.Decide(violated));
    }
}
