using Fraudio.Application.Fraud;
using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Fraudio.Infrastructure.Persistence;

public sealed class FraudioDbContext : DbContext, IFraudioDbContext
{
    public FraudioDbContext(DbContextOptions<FraudioDbContext> options)
        : base(options)
    {
    }

    public DbSet<ApplicationUser> ApplicationUsers => Set<ApplicationUser>();
    public DbSet<TransactionUser> TransactionUsers => Set<TransactionUser>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<FraudResult> FraudResults => Set<FraudResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var roleConverter = new EnumToStringConverter<ApplicationRole>();
        var statusConverter = new EnumToStringConverter<TransactionStatus>();

        modelBuilder.Entity<ApplicationUser>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Username).IsRequired().HasMaxLength(64);
            b.Property(x => x.Email).IsRequired().HasMaxLength(256);
            b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(512);
            b.Property(x => x.Role).HasConversion(roleConverter).HasMaxLength(16);
            b.Property(x => x.CreatedAt).IsRequired();
            b.HasIndex(x => x.Username).IsUnique();
        });

        modelBuilder.Entity<TransactionUser>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.ExternalUserId).IsRequired().HasMaxLength(128);
            b.Property(x => x.CreatedAt).IsRequired();
            b.HasIndex(x => x.ExternalUserId).IsUnique();
        });

        modelBuilder.Entity<Transaction>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Amount).IsRequired().HasPrecision(18, 2);
            b.Property(x => x.City).HasMaxLength(128);
            b.Property(x => x.Country).HasMaxLength(128);
            b.Property(x => x.OccurredAt).IsRequired();
            b.Property(x => x.CreatedAt).IsRequired();
            b.Property(x => x.Status).HasConversion(statusConverter).HasMaxLength(16);

            b.HasOne(x => x.TransactionUser)
                .WithMany(u => u.Transactions)
                .HasForeignKey(x => x.TransactionUserId)
                .OnDelete(DeleteBehavior.Restrict);
            
            b.HasIndex(x => new { x.TransactionUserId, x.OccurredAt });
            b.HasIndex(x => new { x.Status, x.OccurredAt });
        });

        modelBuilder.Entity<FraudResult>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.TransactionId).IsRequired();
            b.Property(x => x.DetectedAt).IsRequired();
            b.HasIndex(x => x.TransactionId).IsUnique();

            b.HasOne(x => x.Transaction)
                .WithOne(t => t.FraudResult)
                .HasForeignKey<FraudResult>(x => x.TransactionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

    }
}
