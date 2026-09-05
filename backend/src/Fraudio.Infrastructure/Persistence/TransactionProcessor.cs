using Fraudio.Application;
using Fraudio.Domain;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Infrastructure.Persistence;

public sealed class TransactionProcessor(FraudioDbContext db, FraudDetectionService fraudDetection) : ITransactionProcessor
{
    public async Task<ProcessedTransaction?> ProcessAsync(TransactionReceived input, CancellationToken cancellationToken)
    {
        if (await db.Transactions.AnyAsync(x => x.Id == input.TransactionId, cancellationToken)) return null;
        var user = await db.TransactionUsers.SingleOrDefaultAsync(x => x.ExternalUserId == input.UserId, cancellationToken);
        if (user is null) { user = new TransactionUser { ExternalUserId = input.UserId }; db.TransactionUsers.Add(user); }
        var processed = await fraudDetection.EvaluateAsync(input, cancellationToken);
        var transaction = new Transaction { Id = input.TransactionId, TransactionUser = user, Amount = input.Amount, Latitude = input.Latitude, Longitude = input.Longitude, City = input.City, Country = input.Country, OccurredAt = input.OccurredAt, Status = processed.Evaluation.Status };
        db.Transactions.Add(transaction);
        db.FraudResults.Add(new FraudResult { Transaction = transaction, VelocityTriggered = processed.Evaluation.VelocityTriggered, AmountTriggered = processed.Evaluation.AmountTriggered, LocationTriggered = processed.Evaluation.LocationTriggered });
        await db.SaveChangesAsync(cancellationToken);
        return processed;
    }
}
