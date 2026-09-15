namespace Fraudio.Domain.Fraud;

public static class AmountFraudRule
{
    public const decimal Multiplier = 3m;
    
    public static bool IsViolated(decimal currentAmount, decimal? priorAverage) =>
        priorAverage.HasValue && currentAmount > priorAverage.Value * Multiplier;
}
