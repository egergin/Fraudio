using Fraudio.Application.Messaging;
using Fraudio.Application.Realtime;
using Fraudio.Application.State;
using Fraudio.Domain.Entities;
using Fraudio.Domain.Enums;
using Fraudio.Domain.Fraud;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Fraudio.Application.Fraud;

public sealed record FraudOutcome(
    Guid TransactionId,
    TransactionStatus Status,
    bool VelocityTriggered,
    bool AmountTriggered,
    bool? LocationTriggered)
{
    public IReadOnlyList<string> TriggeredRules
    {
        get
        {
            var rules = new List<string>(3);
            if (VelocityTriggered) rules.Add("Velocity");
            if (AmountTriggered) rules.Add("Amount");
            if (LocationTriggered is true) rules.Add("Location");
            return rules;
        }
    }
}

public interface IFraudDetectionService
{
    Task<FraudOutcome> ProcessAsync(
        TransactionReceivedMessage message, CancellationToken cancellationToken = default);
}

public sealed class FraudDetectionService : IFraudDetectionService
{
    private readonly IFraudioDbContext _db;
    private readonly IVelocityStore _velocity;
    private readonly IAmountStore _amounts;
    private readonly ILocationStore _locations;
    private readonly IFraudEventPublisher _events;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<FraudDetectionService> _logger;

    public FraudDetectionService(
        IFraudioDbContext db,
        IVelocityStore velocity,
        IAmountStore amounts,
        ILocationStore locations,
        IFraudEventPublisher events,
        IRealtimeNotifier realtime,
        ILogger<FraudDetectionService> logger)
    {
        _db = db;
        _velocity = velocity;
        _amounts = amounts;
        _locations = locations;
        _events = events;
        _realtime = realtime;
        _logger = logger;
    }

    public async Task<FraudOutcome> ProcessAsync(
        TransactionReceivedMessage message, CancellationToken cancellationToken = default)
    {
        var existing = await _db.Transactions
            .Include(t => t.FraudResult)
            .Include(t => t.TransactionUser)
            .FirstOrDefaultAsync(t => t.Id == message.TransactionId, cancellationToken);

        if (existing is not null)
        {
            _logger.LogInformation(
                "Duplicate TransactionReceived ignored {TransactionId}", message.TransactionId);
            var replay = ToOutcome(existing);
            await EnsureStateAsync(message, cancellationToken);
            await PublishAsync(
                existing.TransactionUser.ExternalUserId, replay,
                existing.Amount, existing.City, message.OccurredAt, cancellationToken);
            return replay;
        }

        var velocityCount = await _velocity.AddAndCountAsync(
            message.UserId, message.TransactionId, message.OccurredAt, cancellationToken);
        var priorAverage = await _amounts.GetAverageAsync(
            message.UserId, message.OccurredAt, cancellationToken);
        var lastLocation = await _locations.GetAsync(message.UserId, cancellationToken);

        var velocityHit = VelocityFraudRule.IsViolated(velocityCount);
        var amountHit = AmountFraudRule.IsViolated(message.Amount, priorAverage);
        var currentPoint = message.Latitude.HasValue && message.Longitude.HasValue
            ? new GeoPoint(message.Latitude.Value, message.Longitude.Value)
            : null;
        var previousPoint = lastLocation is null
            ? null
            : new GeoPoint(lastLocation.Latitude, lastLocation.Longitude);
        var locationHit = LocationFraudRule.IsViolated(
            previousPoint,
            lastLocation?.OccurredAt ?? DateTime.MinValue,
            currentPoint,
            message.OccurredAt);

        var violated = (velocityHit ? 1 : 0) + (amountHit ? 1 : 0) + (locationHit is true ? 1 : 0);
        var status = FraudDecision.Decide(violated);
        var outcome = new FraudOutcome(message.TransactionId, status, velocityHit, amountHit, locationHit);

        var user = await _db.TransactionUsers
            .FirstOrDefaultAsync(u => u.ExternalUserId == message.UserId, cancellationToken);
        if (user is null)
        {
            user = new TransactionUser
            {
                Id = Guid.NewGuid(),
                ExternalUserId = message.UserId,
                CreatedAt = DateTime.UtcNow
            };
            _db.TransactionUsers.Add(user);
        }

        var transaction = new Transaction
        {
            Id = message.TransactionId,
            TransactionUser = user,
            Amount = message.Amount,
            Latitude = message.Latitude,
            Longitude = message.Longitude,
            City = message.City,
            Country = message.Country,
            OccurredAt = message.OccurredAt,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
        _db.Transactions.Add(transaction);
        _db.FraudResults.Add(new FraudResult
        {
            Id = Guid.NewGuid(),
            TransactionId = transaction.Id,
            VelocityTriggered = velocityHit,
            AmountTriggered = amountHit,
            LocationTriggered = locationHit,
            DetectedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);

        await EnsureStateAsync(message, cancellationToken);
        await PublishAsync(
            user.ExternalUserId, outcome,
            message.Amount, message.City, message.OccurredAt, cancellationToken);

        _logger.LogInformation(
            "TransactionProcessed {TransactionId} {UserId} {Status}",
            message.TransactionId, message.UserId, status);
        return outcome;
    }
    
    private async Task EnsureStateAsync(TransactionReceivedMessage message, CancellationToken ct)
    {
        await _amounts.RecordAsync(
            message.UserId, message.TransactionId, message.Amount, message.OccurredAt, ct);

        if (message.Latitude.HasValue && message.Longitude.HasValue)
        {
            var stored = await _locations.GetAsync(message.UserId, ct);
            if (stored is null || stored.OccurredAt <= message.OccurredAt)
            {
                await _locations.SetAsync(message.UserId, new LastLocation(
                    message.Latitude.Value,
                    message.Longitude.Value,
                    message.City,
                    message.Country,
                    message.OccurredAt), ct);
            }
        }
    }

    private async Task PublishAsync(
        string userId, FraudOutcome outcome, decimal amount, string? city,
        DateTime occurredAt, CancellationToken ct)
    {
        await _events.PublishAsync(new FraudDetectedMessage(
            outcome.TransactionId,
            userId,
            outcome.Status.ToString(),
            outcome.TriggeredRules,
            occurredAt), ct);

        _logger.LogInformation(
            "FraudDetected {TransactionId} {UserId} {Status} {Rules}",
            outcome.TransactionId, userId, outcome.Status,
            outcome.TriggeredRules.Count == 0 ? "-" : string.Join(",", outcome.TriggeredRules));

        await _realtime.FraudProcessedAsync(
            outcome, userId, amount, city, occurredAt, ct);
    }

    private static FraudOutcome ToOutcome(Transaction transaction) =>
        new(
            transaction.Id,
            transaction.Status,
            transaction.FraudResult?.VelocityTriggered ?? false,
            transaction.FraudResult?.AmountTriggered ?? false,
            transaction.FraudResult?.LocationTriggered);
}
