using Fraudio.Application.Fraud;
using Fraudio.Application.Geolocation;
using Fraudio.Application.Messaging;
using Fraudio.Application.Realtime;
using Fraudio.Application.State;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Fraudio.Tests;

public sealed class FraudDetectionServiceTests
{
    private static FraudioDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<FraudioDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new FraudioDbContext(options);
    }

    private static TransactionReceivedMessage Message(
        Guid? id = null, string user = "user-123", decimal amount = 100m,
        double? lat = 41.0082, double? lon = 28.9784, string? city = "Istanbul") =>
        new(id ?? Guid.NewGuid(), user, amount, lat, lon, city, "Türkiye", DateTime.UtcNow);

    private static FraudDetectionService Service(
        FraudioDbContext db,
        IVelocityStore? velocity = null,
        IAmountStore? amounts = null,
        ILocationStore? locations = null,
        FakeEventPublisher? events = null)
    {
        events ??= new FakeEventPublisher();
        return new FraudDetectionService(
            db,
            velocity ?? new FakeVelocityStore(1),
            amounts ?? new FakeAmountStore(null),
            locations ?? new FakeLocationStore(null),
            events,
            new FakeNotifier(),
            NullLogger<FraudDetectionService>.Instance);
    }

    [Fact]
    public async Task FirstTransaction_IsApproved_CreatesUserAndResult()
    {
        using var db = NewDb();
        var events = new FakeEventPublisher();
        var service = Service(db, events: events);
        var message = Message();

        var outcome = await service.ProcessAsync(message);

        Assert.Equal(TransactionStatus.Approved, outcome.Status);
        Assert.False(outcome.VelocityTriggered);
        Assert.False(outcome.AmountTriggered);
        Assert.False(outcome.LocationTriggered);

        var user = await db.TransactionUsers.FirstOrDefaultAsync(u => u.ExternalUserId == "user-123");
        Assert.NotNull(user);
        var stored = await db.Transactions.Include(t => t.FraudResult)
            .FirstOrDefaultAsync(t => t.Id == message.TransactionId);
        Assert.NotNull(stored);
        Assert.Equal(TransactionStatus.Approved, stored.Status);
        Assert.NotNull(stored.FraudResult);
        Assert.Single(events.Published);
        Assert.Equal("Approved", events.Published[0].Status);
        Assert.Empty(events.Published[0].TriggeredRules);
    }

    [Fact]
    public async Task VelocityPlusAmount_IsSuspicious_PublishesTriggeredRules()
    {
        using var db = NewDb();
        var events = new FakeEventPublisher();
        var service = Service(
            db,
            velocity: new FakeVelocityStore(6),
            amounts: new FakeAmountStore(100m),
            events: events);

        var outcome = await service.ProcessAsync(Message(amount: 500m));

        Assert.Equal(TransactionStatus.Suspicious, outcome.Status);
        Assert.Equal(new[] { "Velocity", "Amount" }, outcome.TriggeredRules);
        Assert.Single(events.Published);
        Assert.Equal("Suspicious", events.Published[0].Status);
        Assert.Equal(new[] { "Velocity", "Amount" }, events.Published[0].TriggeredRules);
    }

    [Fact]
    public async Task UnresolvableLocation_MarksNotEvaluated_DoesNotFraudAlone()
    {
        using var db = NewDb();
        var service = Service(db);
        var message = Message(lat: null, lon: null, city: "UnknownCity");

        var outcome = await service.ProcessAsync(message);

        Assert.Null(outcome.LocationTriggered);
        Assert.Equal(TransactionStatus.Approved, outcome.Status);
        var stored = await db.Transactions.Include(t => t.FraudResult)
            .FirstOrDefaultAsync(t => t.Id == message.TransactionId);
        Assert.Null(stored!.FraudResult!.LocationTriggered);
    }

    [Fact]
    public async Task DuplicateDelivery_DoesNotRecreate_RepublishesOutcome()
    {
        using var db = NewDb();
        var events = new FakeEventPublisher();
        var velocity = new FakeVelocityStore(1);
        var service = Service(db, velocity: velocity, events: events);
        var message = Message();

        var first = await service.ProcessAsync(message);
        var second = await service.ProcessAsync(message);

        Assert.Equal(first, second);
        Assert.Equal(1, await db.Transactions.CountAsync(t => t.Id == message.TransactionId));
        Assert.Equal(1, await db.TransactionUsers.CountAsync(u => u.ExternalUserId == "user-123"));
        Assert.Equal(2, events.Published.Count);
        Assert.Equal(1, velocity.AddCalls);
    }

    private sealed class FakeVelocityStore(long count) : IVelocityStore
    {
        public int AddCalls { get; private set; }

        public Task<long> AddAndCountAsync(
            string userId, Guid transactionId, DateTime occurredAt, CancellationToken ct = default)
        {
            AddCalls++;
            return Task.FromResult(count);
        }
    }

    private sealed class FakeAmountStore(decimal? average) : IAmountStore
    {
        public List<(string UserId, Guid TxnId, decimal Amount)> Recorded { get; } = [];

        public Task<decimal?> GetAverageAsync(string userId, DateTime now, CancellationToken ct = default) =>
            Task.FromResult(average);

        public Task RecordAsync(
            string userId, Guid transactionId, decimal amount, DateTime occurredAt, CancellationToken ct = default)
        {
            Recorded.Add((userId, transactionId, amount));
            return Task.CompletedTask;
        }
    }

    private sealed class FakeLocationStore(LastLocation? current) : ILocationStore
    {
        public LastLocation? Stored { get; private set; } = current;

        public Task<LastLocation?> GetAsync(string userId, CancellationToken ct = default) =>
            Task.FromResult(Stored);

        public Task SetAsync(string userId, LastLocation location, CancellationToken ct = default)
        {
            Stored = location;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeEventPublisher : IFraudEventPublisher
    {
        public List<FraudDetectedMessage> Published { get; } = [];

        public Task PublishAsync(FraudDetectedMessage message, CancellationToken ct = default)
        {
            Published.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeNotifier : IRealtimeNotifier
    {
        public Task TransactionReceivedAsync(
            Guid transactionId, string userId, decimal amount, string? city,
            DateTime occurredAt, CancellationToken ct = default) => Task.CompletedTask;

        public Task FraudProcessedAsync(
            FraudOutcome outcome, string userId, decimal amount, string? city,
            DateTime occurredAt, CancellationToken ct = default) => Task.CompletedTask;
    }
}
