using Fraudio.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Fraudio.Infrastructure.Persistence;

public sealed class DemoDataSeeder(
IServiceScopeFactory scopeFactory,
ILogger<DemoDataSeeder> logger) : BackgroundService
{
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
// TransactionWorker ve uygulamanın diğer servislerinin ayağa kalkması için
// kısa bir süre bekliyoruz.
await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);

    try
    {
        using var scope = scopeFactory.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<FraudioDbContext>();
        var processor = scope.ServiceProvider.GetRequiredService<ITransactionProcessor>();

        // Seed daha önce yapıldıysa tekrar üretme.
        if (await db.Transactions.AnyAsync(stoppingToken))
        {
            logger.LogInformation("Demo işlem verileri zaten mevcut. Demo seed atlanıyor.");
            return;
        }

        logger.LogInformation("Demo işlem verileri oluşturuluyor...");

        var now = DateTime.UtcNow;

        // ------------------------------------------------------------
        // customer-001: Normal işlemler
        // ------------------------------------------------------------

        await Process(
            processor,
            "customer-001",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            now.AddMinutes(-10),
            stoppingToken);

        await Process(
            processor,
            "customer-001",
            150m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            now.AddMinutes(-8),
            stoppingToken);

        await Process(
            processor,
            "customer-001",
            200m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            now.AddMinutes(-6),
            stoppingToken);

        // ------------------------------------------------------------
        // customer-002:
        // Istanbul -> New York + yüksek amount
        // ------------------------------------------------------------

        await Process(
            processor,
            "customer-002",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            now.AddMinutes(-5),
            stoppingToken);

        await Process(
            processor,
            "customer-002",
            150m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            now.AddMinutes(-4),
            stoppingToken);

        // Önceki ortalama = 125
        // 5000 > 125 * 3 => AmountTriggered
        //
        // Istanbul -> New York kısa sürede gerçekleştiği için
        // LocationTriggered da true olacaktır.
        await Process(
            processor,
            "customer-002",
            5000m,
            40.7128,
            -74.0060,
            "New York",
            "United States",
            now.AddMinutes(-3),
            stoppingToken);

        // ------------------------------------------------------------
        // customer-003:
        // 6'dan fazla işlem / dakika + yüksek amount
        // ------------------------------------------------------------

        var velocityBase = now.AddSeconds(-50);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase,
            stoppingToken);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(5),
            stoppingToken);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(10),
            stoppingToken);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(15),
            stoppingToken);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(20),
            stoppingToken);

        await Process(
            processor,
            "customer-003",
            100m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(25),
            stoppingToken);

        // 7. transaction:
        // velocityCount > 5 => VelocityTriggered
        // 1000 > 100 * 3 => AmountTriggered
        // => Suspicious
        await Process(
            processor,
            "customer-003",
            1000m,
            41.0082,
            28.9784,
            "Istanbul",
            "Turkey",
            velocityBase.AddSeconds(30),
            stoppingToken);

        logger.LogInformation("Demo işlem verileri başarıyla oluşturuldu.");
    }
    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
    {
        // Application shutdown sırasında beklenen durum.
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Demo işlem verisi oluşturma başarısız oldu.");
    }
}

private static async Task Process(
    ITransactionProcessor processor,
    string userId,
    decimal amount,
    double latitude,
    double longitude,
    string city,
    string country,
    DateTime occurredAt,
    CancellationToken cancellationToken)
{
    var transaction = new TransactionReceived(
        Guid.NewGuid(),
        userId,
        amount,
        latitude,
        longitude,
        city,
        country,
        occurredAt);

    await processor.ProcessAsync(transaction, cancellationToken);
}


}
