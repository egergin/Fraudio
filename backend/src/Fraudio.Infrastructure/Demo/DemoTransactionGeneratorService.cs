using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Fraudio.Infrastructure.Demo;

/// <summary>
/// Demo işlem üretecini periyodik olarak çalıştıran barındırılan servis.
///
/// Mevcut backend konteynerinin içinde çalışır; ayrı bir süreç veya port
/// gerektirmez. Yalnızca DEMO_TRANSACTION_GENERATOR_ENABLED=true olduğunda
/// kaydedilir.
///
/// Çakışma güvenliği: <see cref="PeriodicTimer"/> bir sonraki tik'i ancak
/// gövde tamamlandıktan sonra bekler. Döngü ardışıktır, dolayısıyla bir
/// üretim beklenenden uzun sürerse tikler sıraya girmez ve üst üste binen
/// çalıştırma oluşmaz.
/// </summary>
public sealed class DemoTransactionGeneratorService(
    IServiceScopeFactory scopeFactory,
    DemoTransactionOptions options,
    ILogger<DemoTransactionGeneratorService> logger,
    TimeProvider timeProvider) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var warning in options.Warnings)
        {
            logger.LogWarning("Demo işlem üreteci yapılandırma uyarısı: {Warning}", warning);
        }

        logger.LogInformation(
            "Demo işlem üreteci başlatıldı. Aralık: {IntervalMinutes} dakika, tutar aralığı: {MinAmount}-{MaxAmount}, " +
            "konum sayısı: {LocationCount}, açılışta çalıştır: {RunOnStartup}",
            options.Interval.TotalMinutes,
            options.MinAmount,
            options.MaxAmount,
            options.Locations.Count,
            options.RunOnStartup);

        // Açılışta üretim yalnızca açıkça istenirse yapılır; varsayılan
        // davranış önce bir aralık beklemektir.
        if (options.RunOnStartup)
        {
            logger.LogInformation(
                "{Key} etkin; açılış demo işlemi üretiliyor.", DemoTransactionOptions.RunOnStartupKey);
            await RunOnceSafelyAsync(stoppingToken);
        }

        using var timer = new PeriodicTimer(options.Interval, timeProvider);

        try
        {
            // WaitForNextTickAsync ancak gövde bittikten sonra tekrar
            // beklenir; bu da örtüşmeyen, ardışık çalıştırma garantisi verir.
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunOnceSafelyAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Uygulama kapanışı sırasında beklenen durum.
        }

        logger.LogInformation("Demo işlem üreteci durduruldu.");
    }

    /// <summary>
    /// Tek bir üretim turunu çalıştırır. Hiçbir hata döngüyü sonlandırmaz:
    /// hata loglanır ve bir sonraki zamanlanmış tur normal şekilde devam eder.
    /// </summary>
    private async Task RunOnceSafelyAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Her tur için yeni bir kapsam: DbContext kapsamlı bir servistir
            // ve barındırılan tekil servis içinde yeniden kullanılamaz.
            using var scope = scopeFactory.CreateScope();
            var generator = scope.ServiceProvider.GetRequiredService<IDemoTransactionGenerator>();

            var result = await generator.GenerateAsync(cancellationToken);

            if (!result.Published)
            {
                logger.LogWarning("Demo işlem üretilmedi: {Reason}", result.Reason);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Kapanış; yeniden fırlatılır ki döngü temiz biçimde sonlansın.
            throw;
        }
        catch (Exception ex)
        {
            // Kuyruk erişilemez, veritabanı düşmüş vb. — üreteç ölmemeli.
            logger.LogError(ex, "Demo işlem üretimi başarısız oldu; bir sonraki zamanlanmış turda yeniden denenecek.");
        }
    }
}
