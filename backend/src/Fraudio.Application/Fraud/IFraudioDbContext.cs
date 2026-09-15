using Fraudio.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Application.Fraud;

public interface IFraudioDbContext
{
    DbSet<ApplicationUser> ApplicationUsers { get; }
    DbSet<TransactionUser> TransactionUsers { get; }
    DbSet<Transaction> Transactions { get; }
    DbSet<FraudResult> FraudResults { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
