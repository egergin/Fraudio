namespace Fraudio.Domain;

public enum ApplicationRole { Admin, Analyst }
public enum TransactionStatus { Approved, Suspicious }

public sealed class ApplicationUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Username { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public ApplicationRole Role { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class TransactionUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string ExternalUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}

public sealed class Transaction
{
    public Guid Id { get; set; }
    public Guid TransactionUserId { get; set; }
    public decimal Amount { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public required string City { get; set; }
    public required string Country { get; set; }
    public DateTime OccurredAt { get; set; }
    public TransactionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public TransactionUser? TransactionUser { get; set; }
    public FraudResult? FraudResult { get; set; }
}

public sealed class FraudResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TransactionId { get; set; }
    public bool VelocityTriggered { get; set; }
    public bool AmountTriggered { get; set; }
    public bool LocationTriggered { get; set; }
    public DateTime DetectedAt { get; set; } = DateTime.UtcNow;
    public Transaction? Transaction { get; set; }
}
