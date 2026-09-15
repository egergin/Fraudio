using Fraudio.Domain.Enums;

namespace Fraudio.Domain.Entities;

public sealed class Transaction
{
    public Guid Id { get; set; }

    public Guid TransactionUserId { get; set; }

    public TransactionUser TransactionUser { get; set; } = null!;
    
    public decimal Amount { get; set; }
    
    public double? Latitude { get; set; }
    
    public double? Longitude { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }
    
    public DateTime OccurredAt { get; set; }

    public TransactionStatus Status { get; set; }
    
    public DateTime CreatedAt { get; set; }

    public FraudResult? FraudResult { get; set; }
}
