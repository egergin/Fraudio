namespace Fraudio.Domain.Fraud;

public static class VelocityFraudRule
{
    public const int MaxAllowedPerMinute = 5;

    public static bool IsViolated(long trailingOneMinuteCount) =>
        trailingOneMinuteCount > MaxAllowedPerMinute;
}
