using Fraudio.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fraudio.Api.Controllers;
[ApiController, Route("api/transactions"), Authorize(Roles = "Admin")]
public sealed class TransactionsController(IGeolocationService geolocation, ITransactionMessagePublisher publisher, IRealtimeNotifier realtime, ILogger<TransactionsController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Submit(SubmitTransactionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Location) || request.Amount <= 0) return BadRequest(new { code = "INVALID_TRANSACTION", message = "Kullanıcı kimliği, pozitif tutar ve konum gereklidir." });
        var resolved = await geolocation.ResolveAsync(request.Location, ct);
        var latitude = resolved?.Latitude ?? 0;
        var longitude = resolved?.Longitude ?? 0;
        var city = resolved?.City ?? request.Location;
        var country = resolved?.Country ?? "Unknown";
        var transaction = new TransactionReceived(Guid.NewGuid(), request.UserId, request.Amount, latitude, longitude, city, country, DateTime.UtcNow);
        await publisher.PublishAsync(transaction, ct);
        logger.LogInformation("TransactionReceived {TransactionId} {UserId}", transaction.TransactionId, transaction.UserId);
        await realtime.PublishAsync(new { eventType = "transaction.received", transactionId = transaction.TransactionId, userId = transaction.UserId, amount = transaction.Amount, city = transaction.City, status = "Received", occurredAt = transaction.OccurredAt }, ct);
        return Accepted(new { transactionId = transaction.TransactionId, status = "Accepted" });
    }
}
public sealed record SubmitTransactionRequest(string UserId, decimal Amount, string Location);
