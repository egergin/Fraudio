using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Infrastructure.Persistence;

public static class SeedData
{
    public static readonly Guid AdminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid AnalystId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    
    private const string AdminPasswordHash =
        "PBKDF2$210000$262/sjL+RuD3J9qJErRjvw==$/TW82kPfRXF71aeyFv2+EG70QWz0YQYw6eNOM2dhSIE=";
    private const string AnalystPasswordHash =
        "PBKDF2$210000$s5A0QBkY4alJwGYZ3gpcfg==$4fnCKcvUCTcyz0OMzhSKAw1pFbgQV9ylH5ZMXMHBLJc=";

    public static ApplicationUser[] Users() =>
    [
        new()
        {
            Id = AdminId,
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = AdminPasswordHash,
            Role = ApplicationRole.Admin,
            CreatedAt = SeededAt
        },
        new()
        {
            Id = AnalystId,
            Username = "analyst",
            Email = "analyst@example.com",
            PasswordHash = AnalystPasswordHash,
            Role = ApplicationRole.Analyst,
            CreatedAt = SeededAt
        }
    ];

    /// <summary>
    /// Applies SEED_* env credentials to the database (create if missing,
    /// update the hash only when the current one doesn't verify, so restarts
    /// without config changes are no-ops). HasData alone can't do this since
    /// it only runs inside migrations.
    /// </summary>
    public static async Task EnsureSeedUsersAsync(
        FraudioDbContext db,
        string adminUsername, string adminPassword, string adminEmail,
        string analystUsername, string analystPassword, string analystEmail,
        CancellationToken cancellationToken = default)
    {
        await EnsureOneAsync(db, adminUsername, adminPassword, adminEmail,
            ApplicationRole.Admin, cancellationToken);
        await EnsureOneAsync(db, analystUsername, analystPassword, analystEmail,
            ApplicationRole.Analyst, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureOneAsync(
        FraudioDbContext db,
        string username, string password, string email, ApplicationRole role,
        CancellationToken cancellationToken)
    {
        var user = await db.ApplicationUsers
            .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower(), cancellationToken);
        if (user is null)
        {
            db.ApplicationUsers.Add(new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = email,
                PasswordHash = PasswordHasher.Hash(password),
                Role = role,
                CreatedAt = DateTime.UtcNow
            });
            return;
        }

        user.Email = email;
        user.Role = role;
        if (!PasswordHasher.Verify(password, user.PasswordHash))
        {
            user.PasswordHash = PasswordHasher.Hash(password);
        }
    }
}
