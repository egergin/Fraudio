using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Infrastructure.Persistence;

public static class SeedData
{
    public static async Task EnsureSeedUsersAsync(
        FraudioDbContext db,
        string adminUsername,
        string adminPassword,
        string adminEmail,
        string analystUsername,
        string analystPassword,
        string analystEmail,
        CancellationToken cancellationToken = default)
    {
        await EnsureOneAsync(
            db,
            adminUsername,
            adminPassword,
            adminEmail,
            ApplicationRole.Admin,
            cancellationToken);

        await EnsureOneAsync(
            db,
            analystUsername,
            analystPassword,
            analystEmail,
            ApplicationRole.Analyst,
            cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureOneAsync(
        FraudioDbContext db,
        string username,
        string password,
        string email,
        ApplicationRole role,
        CancellationToken cancellationToken)
    {
        var user = await db.ApplicationUsers
            .FirstOrDefaultAsync(
                u => u.Username.ToLower() == username.ToLower(),
                cancellationToken);

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

