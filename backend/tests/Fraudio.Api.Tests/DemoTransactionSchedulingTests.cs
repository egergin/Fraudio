using Fraudio.Infrastructure.Demo;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Fraudio.Api.Tests;

/// <summary>
/// Barındırılan servisin zamanlama davranışı.
///
/// Tüm testler <see cref="FakeTimeProvider"/> ile sanal zamanda ilerler;
/// hiçbiri gerçek 30 dakika beklemez.
/// </summary>
public sealed class DemoTransactionSchedulingTests
{
    /// <summary>Çağrıları sayan, davranışı yapılandırılabilir sahte üreteç.</summary>
    private sealed class RecordingGenerator : IDemoTransactionGenerator
    {
        private readonly Func<CancellationToken, Task<DemoTransactionResult>> _behaviour;

        public RecordingGenerator(Func<CancellationToken, Task<DemoTransactionResult>>? behaviour = null)
            => _behaviour = behaviour ?? (_ => Task.FromResult(DemoTransactionResult.Skipped("test")));

        public int CallCount;
        public int Concurrent;
        public int MaxConcurrent;

        public async Task<DemoTransactionResult> GenerateAsync(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref CallCount);

            var current = Interlocked.Increment(ref Concurrent);
            // Gözlemlenen en yüksek eşzamanlılık; 1'den büyükse örtüşme var.
            InterlockedMax(ref MaxConcurrent, current);

            try
            {
                return await _behaviour(cancellationToken);
            }
            finally
            {
                Interlocked.Decrement(ref Concurrent);
            }
        }

        private static void InterlockedMax(ref int target, int value)
        {
            int start;
            do
            {
                start = Volatile.Read(ref target);
                if (start >= value) return;
            }
            while (Interlocked.CompareExchange(ref target, value, start) != start);
        }
    }

    private static (DemoTransactionGeneratorService Service, RecordingGenerator Generator, FakeTimeProvider Time)
        CreateService(DemoTransactionOptions options, RecordingGenerator? generator = null)
    {
        var recording = generator ?? new RecordingGenerator();

        var services = new ServiceCollection();
        services.AddScoped<IDemoTransactionGenerator>(_ => recording);
        var provider = services.BuildServiceProvider();

        var time = new FakeTimeProvider(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero));

        var service = new DemoTransactionGeneratorService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            options,
            NullLogger<DemoTransactionGeneratorService>.Instance,
            time);

        return (service, recording, time);
    }

    private static DemoTransactionOptions Options(
        TimeSpan? interval = null, bool runOnStartup = false) => new()
        {
            Enabled = true,
            Interval = interval ?? TimeSpan.FromMinutes(30),
            RunOnStartup = runOnStartup,
        };

    // ---------------------------------------------------------------
    // Açılış davranışı
    // ---------------------------------------------------------------

    [Fact]
    public async Task Does_not_generate_immediately_on_startup_by_default()
    {
        var (service, generator, _) = CreateService(Options());

        await service.StartAsync(CancellationToken.None);
        await Task.Delay(50);

        Assert.Equal(0, generator.CallCount);

        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Generates_immediately_when_run_on_startup_is_enabled()
    {
        var (service, generator, _) = CreateService(Options(runOnStartup: true));

        await service.StartAsync(CancellationToken.None);
        await WaitForAsync(() => generator.CallCount >= 1);

        Assert.Equal(1, generator.CallCount);

        await service.StopAsync(CancellationToken.None);
    }

    // ---------------------------------------------------------------
    // Aralık
    // ---------------------------------------------------------------

    [Fact]
    public async Task Generates_once_per_configured_interval()
    {
        var (service, generator, time) = CreateService(Options(TimeSpan.FromMinutes(30)));

        await service.StartAsync(CancellationToken.None);
        await Task.Delay(50);

        time.Advance(TimeSpan.FromMinutes(30));
        await WaitForAsync(() => generator.CallCount >= 1);
        Assert.Equal(1, generator.CallCount);

        time.Advance(TimeSpan.FromMinutes(30));
        await WaitForAsync(() => generator.CallCount >= 2);
        Assert.Equal(2, generator.CallCount);

        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Does_not_generate_before_the_interval_elapses()
    {
        var (service, generator, time) = CreateService(Options(TimeSpan.FromMinutes(30)));

        await service.StartAsync(CancellationToken.None);
        time.Advance(TimeSpan.FromMinutes(29));
        await Task.Delay(50);

        Assert.Equal(0, generator.CallCount);

        await service.StopAsync(CancellationToken.None);
    }

    // ---------------------------------------------------------------
    // Çakışma önleme
    // ---------------------------------------------------------------

    [Fact]
    public async Task Does_not_start_overlapping_executions_when_generation_is_slow()
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        // İlk çağrı serbest bırakılana kadar bloke olur.
        var generator = new RecordingGenerator(async _ =>
        {
            await gate.Task;
            return DemoTransactionResult.Skipped("test");
        });

        var (service, recording, time) = CreateService(
            Options(TimeSpan.FromMinutes(1)), generator);

        await service.StartAsync(CancellationToken.None);

        // İlk turu tetikle ve gövdenin içinde takılı kalmasını sağla.
        time.Advance(TimeSpan.FromMinutes(1));
        await WaitForAsync(() => recording.CallCount >= 1);

        // Gövde hâlâ çalışırken birkaç aralık daha ilerlet.
        time.Advance(TimeSpan.FromMinutes(5));
        await Task.Delay(80);

        // Örtüşen çalıştırma başlamamalı.
        Assert.Equal(1, recording.CallCount);
        Assert.Equal(1, recording.MaxConcurrent);

        gate.SetResult();
        await service.StopAsync(CancellationToken.None);

        Assert.Equal(1, recording.MaxConcurrent);
    }

    // ---------------------------------------------------------------
    // Hata dayanıklılığı
    // ---------------------------------------------------------------

    [Fact]
    public async Task Continues_scheduling_after_a_generation_failure()
    {
        var calls = 0;
        var generator = new RecordingGenerator(_ =>
        {
            // İlk çağrı patlar; döngü ölmemeli.
            if (Interlocked.Increment(ref calls) == 1)
                throw new InvalidOperationException("kuyruk erişilemiyor");
            return Task.FromResult(DemoTransactionResult.Skipped("test"));
        });

        var (service, recording, time) = CreateService(
            Options(TimeSpan.FromMinutes(10)), generator);

        await service.StartAsync(CancellationToken.None);

        time.Advance(TimeSpan.FromMinutes(10));
        await WaitForAsync(() => recording.CallCount >= 1);

        time.Advance(TimeSpan.FromMinutes(10));
        await WaitForAsync(() => recording.CallCount >= 2);

        Assert.True(recording.CallCount >= 2, "Hata sonrası zamanlama devam etmeliydi.");

        await service.StopAsync(CancellationToken.None);
    }

    // ---------------------------------------------------------------
    // Zarif kapanış
    // ---------------------------------------------------------------

    [Fact]
    public async Task Stops_gracefully_on_cancellation()
    {
        var (service, generator, time) = CreateService(Options(TimeSpan.FromMinutes(1)));

        await service.StartAsync(CancellationToken.None);
        time.Advance(TimeSpan.FromMinutes(1));
        await WaitForAsync(() => generator.CallCount >= 1);

        // StopAsync istisna fırlatmadan tamamlanmalı.
        await service.StopAsync(CancellationToken.None);

        var countAfterStop = generator.CallCount;
        time.Advance(TimeSpan.FromMinutes(10));
        await Task.Delay(50);

        // Durdurulduktan sonra yeni üretim olmamalı.
        Assert.Equal(countAfterStop, generator.CallCount);
    }

    [Fact]
    public async Task Stop_completes_even_when_never_ticked()
    {
        var (service, _, _) = CreateService(Options(TimeSpan.FromHours(12)));

        await service.StartAsync(CancellationToken.None);
        await service.StopAsync(CancellationToken.None);
    }

    /// <summary>Koşul sağlanana kadar kısa aralıklarla yoklar.</summary>
    private static async Task WaitForAsync(Func<bool> condition, int timeoutMs = 2000)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        while (DateTime.UtcNow < deadline)
        {
            if (condition()) return;
            await Task.Delay(10);
        }
        Assert.Fail("Koşul zaman aşımına uğradı.");
    }
}
