using Fraudio.Infrastructure.Simulation;

namespace Fraudio.Tests;

public sealed class TransactionSimulatorTests
{
    [Fact]
    public void Defaults_AreValidDemoValues()
    {
        var options = new TransactionSimulatorOptions();

        options.Validate();

        Assert.True(options.Enabled);
        Assert.Equal(30, options.MinDelayMinutes);
        Assert.Equal(120, options.MaxDelayMinutes);
    }

    [Theory]
    [InlineData(120, 30)]
    [InlineData(0, 60)]
    [InlineData(30, -1)]
    public void InvalidDelays_Throw(double min, double max)
    {
        var options = new TransactionSimulatorOptions
        {
            MinDelayMinutes = min,
            MaxDelayMinutes = max
        };

        Assert.Throws<InvalidOperationException>(() => options.Validate());
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.5)]
    public void InvalidProbability_Throws(double probability)
    {
        var options = new TransactionSimulatorOptions { SuspiciousProbability = probability };

        Assert.Throws<InvalidOperationException>(() => options.Validate());
    }

    [Fact]
    public void NextDelay_StaysWithinConfiguredRange()
    {
        var service = new TransactionSimulatorService(
            publisher: null!,
            geolocation: null!,
            options: Microsoft.Extensions.Options.Options.Create(new TransactionSimulatorOptions
            {
                MinDelayMinutes = 1,
                MaxDelayMinutes = 3
            }),
            logger: Microsoft.Extensions.Logging.Abstractions.NullLogger<TransactionSimulatorService>.Instance);

        for (var i = 0; i < 50; i++)
        {
            var delay = service.NextDelay();
            Assert.InRange(delay, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(3));
        }
    }

    [Fact]
    public void RandomAmount_StaysInRealisticBands()
    {
        for (var i = 0; i < 200; i++)
        {
            var amount = TransactionSimulatorService.RandomAmount();
            Assert.InRange(amount, 10m, 5000m);
        }
    }
}
