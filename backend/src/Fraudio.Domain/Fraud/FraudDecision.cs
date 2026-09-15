using Fraudio.Domain.Enums;

namespace Fraudio.Domain.Fraud;

public static class FraudDecision
{
    public static TransactionStatus Decide(int violatedRuleCount) =>
        violatedRuleCount >= 2 ? TransactionStatus.Suspicious : TransactionStatus.Approved;
}
