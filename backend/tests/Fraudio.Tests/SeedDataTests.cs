using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Tests;

public sealed class SeedDataTests
{
    private static FraudioDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<FraudioDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new FraudioDbContext(options);
    }

    private static Task EnsureAsync(FraudioDbContext db,
        string adminPass = "Admin123!", string analystPass = "Analyst123!") =>
        SeedData.EnsureSeedUsersAsync(db,
            "admin", adminPass, "admin@example.com",
            "analyst", analystPass, "analyst@example.com");

    [Fact]
    public async Task Ensure_CreatesMissingUsers_WithVerifiablePasswords()
    {
        using var db = NewDb();
        await EnsureAsync(db);

        var admin = await db.ApplicationUsers.FirstAsync(u => u.Username == "admin");
        Assert.Equal(ApplicationRole.Admin, admin.Role);
        Assert.True(PasswordHasher.Verify("Admin123!", admin.PasswordHash));
        Assert.Equal(2, await db.ApplicationUsers.CountAsync());
    }

    [Fact]
    public async Task Ensure_IsIdempotent_WhenNothingChanged()
    {
        using var db = NewDb();
        await EnsureAsync(db);
        var before = await db.ApplicationUsers.FirstAsync(u => u.Username == "admin");

        await EnsureAsync(db);
        var after = await db.ApplicationUsers.FirstAsync(u => u.Username == "admin");

        Assert.Equal(before.PasswordHash, after.PasswordHash);
        Assert.Equal(2, await db.ApplicationUsers.CountAsync());
    }

    [Fact]
    public async Task Ensure_AppliesChangedEnvPassword()
    {
        using var db = NewDb();
        await EnsureAsync(db, adminPass: "Admin123!");

        await EnsureAsync(db, adminPass: "AdminTest123!");

        var admin = await db.ApplicationUsers.FirstAsync(u => u.Username == "admin");
        Assert.True(PasswordHasher.Verify("AdminTest123!", admin.PasswordHash));
        Assert.False(PasswordHasher.Verify("Admin123!", admin.PasswordHash));
        Assert.Equal(2, await db.ApplicationUsers.CountAsync());
    }
}
