namespace Fraudio.Domain.Entities;

public sealed class TransactionUser
{
    public Guid Id { get; set; }
    
    public string ExternalUserId { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; }

    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
