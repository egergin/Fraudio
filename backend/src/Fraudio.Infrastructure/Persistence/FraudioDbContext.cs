using Fraudio.Domain;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Infrastructure.Persistence;

public sealed class FraudioDbContext(DbContextOptions<FraudioDbContext> options) : DbContext(options)
{
    public DbSet<ApplicationUser> ApplicationUsers => Set<ApplicationUser>();
    public DbSet<TransactionUser> TransactionUsers => Set<TransactionUser>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<FraudResult> FraudResults => Set<FraudResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.Role).HasConversion<string>();
        });
        modelBuilder.Entity<TransactionUser>(entity => entity.HasIndex(x => x.ExternalUserId).IsUnique());
        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Status).HasConversion<string>();
            entity.HasIndex(x => new { x.TransactionUserId, x.OccurredAt });
            entity.HasIndex(x => x.Status);
            entity.HasOne(x => x.TransactionUser).WithMany(x => x.Transactions).HasForeignKey(x => x.TransactionUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.FraudResult).WithOne(x => x.Transaction).HasForeignKey<FraudResult>(x => x.TransactionId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<FraudResult>(entity => entity.HasIndex(x => x.TransactionId).IsUnique());
    }
}
