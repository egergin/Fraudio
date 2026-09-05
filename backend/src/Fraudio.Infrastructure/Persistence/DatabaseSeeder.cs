using Fraudio.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Fraudio.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task MigrateAndSeedAsync(
        FraudioDbContext db,
        Func<ApplicationUser, string, string> hashPassword,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Veritabanı migrasyonları kontrol ediliyor...");
        if (db.Database.IsRelational())
        {
            logger.LogInformation("Veritabanı migrasyonları uygulanıyor...");
            await db.Database.MigrateAsync(cancellationToken);
        }

        var adminPassword = configuration["SEED_ADMIN_PASSWORD"];
        var analystPassword = configuration["SEED_ANALYST_PASSWORD"];

        if (!string.IsNullOrWhiteSpace(adminPassword))
        {
            var adminUser = await db.ApplicationUsers.SingleOrDefaultAsync(x => x.Username == "admin", cancellationToken);
            if (adminUser is null)
            {
                logger.LogInformation("Varsayılan Yönetici kullanıcısı oluşturuluyor...");
                adminUser = new ApplicationUser
                {
                    Username = "admin",
                    Email = "admin@Fraudio.local",
                    PasswordHash = string.Empty,
                    Role = ApplicationRole.Admin
                };
                adminUser.PasswordHash = hashPassword(adminUser, adminPassword);
                db.ApplicationUsers.Add(adminUser);
            }
        }

        if (!string.IsNullOrWhiteSpace(analystPassword))
        {
            var analystUser = await db.ApplicationUsers.SingleOrDefaultAsync(x => x.Username == "analyst", cancellationToken);
            if (analystUser is null)
            {
                logger.LogInformation("Varsayılan Analist kullanıcısı oluşturuluyor...");
                analystUser = new ApplicationUser
                {
                    Username = "analyst",
                    Email = "analyst@Fraudio.local",
                    PasswordHash = string.Empty,
                    Role = ApplicationRole.Analyst
                };
                analystUser.PasswordHash = hashPassword(analystUser, analystPassword);
                db.ApplicationUsers.Add(analystUser);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Veritabanı migrasyon ve başlangıç verisi oluşturma tamamlandı.");
    }
}
