using Fraudio.Application;
using Fraudio.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Fraudio.Infrastructure.Demo;

/// <summary>
/// Tek bir demo işlemi üretip mevcut alım hattına yayınlar.
///
/// Zamanlamadan bilinçli olarak ayrılmıştır: bu sınıf "bir işlem üret"
/// davranışını temsil eder ve gerçek zaman beklemeden deterministik olarak
/// test edilebilir. Zamanlama
/// <see cref="DemoTransactionGeneratorService"/> sorumluluğundadır.
///
/// Akış — normal bir POST /api/transactions çağrısıyla aynıdır:
///   ITransactionMessagePublisher → RabbitMQ (transaction.received)
///     → TransactionWorker → ITransactionProcessor → FraudDetectionService
///       → Redis durumu + PostgreSQL + fraud.detected + WebSocket
///
/// Dolandırıcılık kuralları, kalıcılaştırma veya kuyruk hiçbir şekilde
/// atlanmaz.
/// </summary>
public interface IDemoTransactionGenerator
{
    Task<DemoTransactionResult> GenerateAsync(CancellationToken cancellationToken);
}

/// <param name="Published">İşlem kuyruğa yayınlandı mı.</param>
/// <param name="Reason">Yayınlanmadıysa nedeni (loglama için).</param>
public sealed record DemoTransactionResult(
    bool Published,
    string? Reason = null,
    TransactionReceived? Transaction = null)
{
    public static DemoTransactionResult Skipped(string reason) => new(false, reason);
    public static DemoTransactionResult Success(TransactionReceived transaction) => new(true, null, transaction);
}

public sealed class DemoTransactionGenerator(
    FraudioDbContext db,
    ITransactionMessagePublisher publisher,
    DemoTransactionOptions options,
    ILogger<DemoTransactionGenerator> logger,
    TimeProvider timeProvider) : IDemoTransactionGenerator
{
    /// <summary>
    /// Demo kaynaklı mesajları gerçek trafikten ayırt eden mesaj başlığı.
    /// Şema veya genel API sözleşmesi değişmez; kuyruk metadata'sı kullanılır
    /// (mevcut x-retry-count başlığıyla aynı mekanizma).
    /// </summary>
    public const string SourceHeaderName = "x-source";
    public const string SourceHeaderValue = "demo-generator";

    public async Task<DemoTransactionResult> GenerateAsync(CancellationToken cancellationToken)
    {
        // 1) Gerçekten var olan bir işlem kullanıcısı seç.
        //    ApplicationUsers değil TransactionUsers kullanılır: ilki panel
        //    hesaplarıdır (admin/analyst), işlem sahibi değildir.
        var userIds = await db.TransactionUsers
            .AsNoTracking()
            .Select(x => x.ExternalUserId)
            .ToListAsync(cancellationToken);

        if (userIds.Count == 0)
        {
            return DemoTransactionResult.Skipped(
                "Veritabanında kayıtlı işlem kullanıcısı bulunmuyor; demo işlem üretilmedi.");
        }

        if (options.Locations.Count == 0)
        {
            return DemoTransactionResult.Skipped(
                "Yapılandırılmış demo konumu bulunmuyor; demo işlem üretilmedi.");
        }

        // 2) Rastgele kullanıcı, tutar ve konum.
        //    Random.Shared iş parçacığı güvenlidir.
        var userId = userIds[Random.Shared.Next(userIds.Count)];
        var location = options.Locations[Random.Shared.Next(options.Locations.Count)];
        var amount = NextAmount(options.MinAmount, options.MaxAmount);

        var transaction = new TransactionReceived(
            Guid.NewGuid(),
            userId,
            amount,
            location.Latitude,
            location.Longitude,
            location.City,
            location.Country,
            timeProvider.GetUtcNow().UtcDateTime);

        // 3) Mevcut yayıncı üzerinden kuyruğa gönder; demo işareti başlıkta.
        await publisher.PublishAsync(
            transaction,
            cancellationToken,
            new Dictionary<string, object?> { [SourceHeaderName] = SourceHeaderValue });

        logger.LogInformation(
            "Demo işlem üretildi {TransactionId} {UserId} {Amount} {City} {Country} {OccurredAt} {Source}",
            transaction.TransactionId,
            transaction.UserId,
            transaction.Amount,
            transaction.City,
            transaction.Country,
            transaction.OccurredAt,
            SourceHeaderValue);

        return DemoTransactionResult.Success(transaction);
    }

    /// <summary>
    /// Yapılandırılan aralıkta, para birimi için iki ondalık basamağa
    /// yuvarlanmış rastgele tutar üretir.
    /// </summary>
    internal static decimal NextAmount(decimal min, decimal max)
    {
        if (max <= min) return decimal.Round(min, 2, MidpointRounding.AwayFromZero);

        // NextDouble [0,1) aralığındadır; decimal'e dönüşüm kuruş hassasiyeti
        // için yeterlidir ve taşma riski taşımaz.
        var fraction = (decimal)Random.Shared.NextDouble();
        var value = min + (max - min) * fraction;

        var rounded = decimal.Round(value, 2, MidpointRounding.AwayFromZero);

        // Yuvarlama sonrası sınırların dışına çıkmayı engelle.
        if (rounded < min) rounded = decimal.Round(min, 2, MidpointRounding.AwayFromZero);
        if (rounded > max) rounded = decimal.Round(max, 2, MidpointRounding.AwayFromZero);

        return rounded;
    }
}
