namespace Fraudio.Infrastructure.Simulation;

public sealed class TransactionSimulatorOptions
{
    public const string SectionName = "Simulator";

    public bool Enabled { get; set; } = true;
    public double MinDelayMinutes { get; set; } = 30;
    public double MaxDelayMinutes { get; set; } = 120;
    public double InitialDelayMinutes { get; set; } = 2;
    public double SuspiciousProbability { get; set; } = 0.15;

    public void Validate()
    {
        if (MinDelayMinutes <= 0 || MaxDelayMinutes <= 0 || InitialDelayMinutes < 0)
        {
            throw new InvalidOperationException("Simulator delays must be positive.");
        }

        if (MinDelayMinutes > MaxDelayMinutes)
        {
            throw new InvalidOperationException(
                "Simulator MinDelayMinutes must not exceed MaxDelayMinutes.");
        }

        if (SuspiciousProbability is < 0 or > 1)
        {
            throw new InvalidOperationException(
                "Simulator SuspiciousProbability must be between 0 and 1.");
        }
    }
}
