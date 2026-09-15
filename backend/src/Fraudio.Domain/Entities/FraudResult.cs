namespace Fraudio.Domain.Entities;

public sealed class FraudResult
{
    public Guid Id { get; set; }
    
    public Guid TransactionId { get; set; }

    public Transaction Transaction { get; set; } = null!;

    public bool VelocityTriggered { get; set; }

    public bool AmountTriggered { get; set; }

    public bool? LocationTriggered { get; set; }
    
    public DateTime DetectedAt { get; set; }
}
