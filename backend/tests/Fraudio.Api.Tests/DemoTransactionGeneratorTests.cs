using Fraudio.Application;
using Fraudio.Domain;
using Fraudio.Infrastructure.Demo;
using Fraudio.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Fraudio.Api.Tests;

/// <summary>
/// Demo işlem üreteci testleri.
///
/// Zamanlama <see cref="FakeTimeProvider"/> ile sanal zamanda ilerletilir;
/// hiçbir test gerçek süre beklemez.
/// </summary>
public sealed class DemoTransactionGeneratorTests
{
    private static FraudioDbContext CreateDb(params string[] userIds)
    {
        var options = new DbContextOptionsBuilder<FraudioDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        var db = new FraudioDbContext(options);
        foreach (var id in userIds)
        {
            db.TransactionUsers.Add(new TransactionUser { ExternalUserId = id });
        }
        db.SaveChanges();
        return db;
    }

    private static DemoTransactionOptions Options(
        decimal min = 10m,
        decimal max = 5000m,
        IReadOnlyList<DemoLocation>? locations = null) => new()
        {
            Enabled = true,
            Interval = TimeSpan.FromMinutes(30),
            MinAmount = min,
            MaxAmount = max,
            Locations = locations ?? DemoLocationCatalogue.All,
        };

    private static DemoTransactionGenerator CreateGenerator(
        FraudioDbContext db,
        ITransactionMessagePublisher publisher,
        DemoTransactionOptions? options = null,
        TimeProvider? timeProvider = null) =>
        new(db,
            publisher,
            options ?? Options(),
            NullLogger<DemoTransactionGenerator>.Instance,
            timeProvider ?? TimeProvider.System);

    // ---------------------------------------------------------------
    // Kullanıcı seçimi
    // ---------------------------------------------------------------

    [Fact]
    public async Task Generator_selects_a_user_that_exists_in_the_database()
    {
        using var db = CreateDb("customer-001", "customer-002", "customer-003");
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var generator = CreateGenerator(db, publisher);

        var result = await generator.GenerateAsync(CancellationToken.None);

        Assert.True(result.Published);
        Assert.Contains(
            result.Transaction!.UserId,
            new[] { "customer-001", "customer-002", "customer-003" });
    }

    [Fact]
    public async Task Generator_skips_gracefully_when_no_users_exist()
    {
        using var db = CreateDb();
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var generator = CreateGenerator(db, publisher);

        var result = await generator.GenerateAsync(CancellationToken.None);

        Assert.False(result.Published);
        Assert.Contains("işlem kullanıcısı bulunmuyor", result.Reason!);
        // Geçersiz veri üretilmemeli.
        await publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, default, default);
    }

    [Fact]
    public async Task Generator_skips_when_no_locations_are_configured()
    {
        using var db = CreateDb("customer-001");
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var generator = CreateGenerator(db, publisher, Options(locations: []));

        var result = await generator.GenerateAsync(CancellationToken.None);

        Assert.False(result.Published);
        await publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, default, default);
    }

    // ---------------------------------------------------------------
    // Tutar üretimi
    // ---------------------------------------------------------------

    [Fact]
    public async Task Generated_amount_stays_within_the_configured_range()
    {
        using var db = CreateDb("customer-001");
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var generator = CreateGenerator(db, publisher, Options(min: 25m, max: 75m));

        for (var i = 0; i < 200; i++)
        {
            var result = await generator.GenerateAsync(CancellationToken.None);
            Assert.InRange(result.Transaction!.Amount, 25m, 75m);
        }
    }

    [Fact]
    public void Generated_amount_is_rounded_to_two_decimals()
    {
        for (var i = 0; i < 200; i++)
        {
            var amount = DemoTransactionGenerator.NextAmount(10m, 5000m);
            Assert.Equal(decimal.Round(amount, 2), amount);
        }
    }

    [Fact]
    public void Generated_amount_handles_equal_min_and_max()
    {
        Assert.Equal(42m, DemoTransactionGenerator.NextAmount(42m, 42m));
    }

    // ---------------------------------------------------------------
    // Konum üretimi
    // ---------------------------------------------------------------

    [Fact]
    public async Task Generated_location_comes_from_the_configured_catalogue()
    {
        using var db = CreateDb("customer-001");
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var allowed = new[] { DemoLocationCatalogue.All[0], DemoLocationCatalogue.All[1] };
        var generator = CreateGenerator(db, publisher, Options(locations: allowed));

        for (var i = 0; i < 50; i++)
        {
            var tx = (await generator.GenerateAsync(CancellationToken.None)).Transaction!;
            Assert.Contains(allowed, x => x.City == tx.City && x.Country == tx.Country);
            // Koordinatlar gömülü katalogdan gelmeli; harici çözümleme yok.
            Assert.NotEqual(0d, tx.Latitude);
            Assert.NotEqual(0d, tx.Longitude);
        }
    }

    // ---------------------------------------------------------------
    // Mevcut alım hattının kullanılması ve demo işareti
    // ---------------------------------------------------------------

    [Fact]
    public async Task Generator_publishes_through_the_existing_message_publisher()
    {
        using var db = CreateDb("customer-001");
        var publisher = Substitute.For<ITransactionMessagePublisher>();
        var generator = CreateGenerator(db, publisher);

        await generator.GenerateAsync(CancellationToken.None);

        // Dolandırıcılık motoru veya veritabanı atlanmamalı: tek çıkış yolu
        // kuyruk yayıncısıdır.
        await publisher.Received(1).PublishAsync(
            Arg.Any<TransactionReceived>(),
            Arg.Any<CancellationToken>(),
            Arg.Any<IDictionary<string, object?>>());
    }

    [Fact]
    public async Task Generated_message_is_tagged_as_demo_source()
    {
        using var db = CreateDb("customer-001");
        IDictionary<string, object?>? captured = null;

        var publisher = Substitute.For<ITransactionMessagePublisher>();
        publisher
            .When(x => x.PublishAsync(
                Arg.Any<TransactionReceived>(),
                Arg.Any<CancellationToken>(),
                Arg.Any<IDictionary<string, object?>?>()))
            .Do(call => captured = call.Arg<IDictionary<string, object?>?>());

        var generator = CreateGenerator(db, publisher);
        await generator.GenerateAsync(CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(
            DemoTransactionGenerator.SourceHeaderValue,
            captured![DemoTransactionGenerator.SourceHeaderName]);
    }

    [Fact]
    public async Task Generated_transaction_uses_the_supplied_time_provider()
    {
        using var db = CreateDb("customer-001");
        var instant = new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);
        var time = new FakeTimeProvider(instant);
        var publisher = Substitute.For<ITransactionMessagePublisher>();

        var generator = CreateGenerator(db, publisher, timeProvider: time);
        var result = await generator.GenerateAsync(CancellationToken.None);

        Assert.Equal(instant.UtcDateTime, result.Transaction!.OccurredAt);
    }

    // ---------------------------------------------------------------
    // Yapılandırma
    // ---------------------------------------------------------------

    private static DemoTransactionOptions Configure(Dictionary<string, string?> values) =>
        DemoTransactionOptions.FromConfiguration(
            new ConfigurationBuilder().AddInMemoryCollection(values).Build());

    [Fact]
    public void Generator_is_disabled_by_default()
    {
        var options = Configure([]);
        Assert.False(options.Enabled);
        Assert.False(options.RunOnStartup);
    }

    [Fact]
    public void Default_interval_is_thirty_minutes()
    {
        Assert.Equal(TimeSpan.FromMinutes(30), Configure([]).Interval);
    }

    [Fact]
    public void Interval_is_read_from_configuration()
    {
        var options = Configure(new() { [DemoTransactionOptions.IntervalKey] = "5" });
        Assert.Equal(TimeSpan.FromMinutes(5), options.Interval);
    }

    [Fact]
    public void Amount_range_is_read_from_configuration()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.MinAmountKey] = "50",
            [DemoTransactionOptions.MaxAmountKey] = "150",
        });

        Assert.Equal(50m, options.MinAmount);
        Assert.Equal(150m, options.MaxAmount);
    }

    [Fact]
    public void Inverted_amount_range_is_corrected_with_a_warning()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.MinAmountKey] = "900",
            [DemoTransactionOptions.MaxAmountKey] = "100",
        });

        Assert.Equal(100m, options.MinAmount);
        Assert.Equal(900m, options.MaxAmount);
        Assert.NotEmpty(options.Warnings);
    }

    [Fact]
    public void Invalid_values_fall_back_to_defaults_without_throwing()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.EnabledKey] = "evet-lutfen",
            [DemoTransactionOptions.IntervalKey] = "yarim-saat",
            [DemoTransactionOptions.MinAmountKey] = "bedava",
        });

        Assert.False(options.Enabled);
        Assert.Equal(TimeSpan.FromMinutes(30), options.Interval);
        Assert.Equal(10m, options.MinAmount);
        Assert.Equal(3, options.Warnings.Count);
    }

    [Fact]
    public void Locations_can_be_restricted_through_configuration()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.LocationsKey] = "Istanbul, Tokyo",
        });

        Assert.Equal(2, options.Locations.Count);
        Assert.Contains(options.Locations, x => x.City == "Istanbul");
        Assert.Contains(options.Locations, x => x.City == "Tokyo");
    }

    [Fact]
    public void Unknown_locations_are_ignored_with_a_warning()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.LocationsKey] = "Istanbul, Atlantis",
        });

        Assert.Single(options.Locations);
        Assert.Contains(options.Warnings, w => w.Contains("Atlantis"));
    }

    [Fact]
    public void Falls_back_to_full_catalogue_when_no_location_is_valid()
    {
        var options = Configure(new()
        {
            [DemoTransactionOptions.LocationsKey] = "Atlantis, El Dorado",
        });

        Assert.Equal(DemoLocationCatalogue.All.Count, options.Locations.Count);
    }
}
