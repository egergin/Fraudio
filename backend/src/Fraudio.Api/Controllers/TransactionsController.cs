using Fraudio.Api.Errors;
using Fraudio.Api.Models;
using Fraudio.Application.Geolocation;
using Fraudio.Application.Messaging;
using Fraudio.Application.Realtime;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/transactions")]
public sealed class TransactionsController : ControllerBase
{
    private const int DefaultLimit = 20;
    private const int MaxLimit = 100;
    private readonly ITransactionPublisher _publisher;
    private readonly IGeolocationService _geolocation;
    private readonly IRealtimeNotifier _realtime;
    private readonly FraudioDbContext _db;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(
        ITransactionPublisher publisher,
        IGeolocationService geolocation,
        IRealtimeNotifier realtime,
        FraudioDbContext db,
        ILogger<TransactionsController> logger)
    {
        _publisher = publisher;
        _geolocation = geolocation;
        _realtime = realtime;
        _db = db;
        _logger = logger;
    }
    
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SubmitTransactionResponse>> Submit(
        [FromBody] SubmitTransactionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            return BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError, "Transaction amount must be greater than zero."));
        }

        var transactionId = Guid.NewGuid();
        var userId = request.UserId.Trim();
        var location = request.Location.Trim();

        _logger.LogInformation(
            "TransactionReceived {TransactionId} {UserId} {Amount} {Location}",
            transactionId, userId, request.Amount, location);

        var coords = await _geolocation.ResolveAsync(location, cancellationToken);
        var occurredAt = DateTime.UtcNow;

        await _publisher.PublishAsync(new TransactionReceivedMessage(
            transactionId,
            userId,
            request.Amount,
            coords?.Latitude,
            coords?.Longitude,
            coords?.City ?? location,
            coords?.Country,
            OccurredAt: occurredAt), cancellationToken);

        await _realtime.TransactionReceivedAsync(
            transactionId, userId, request.Amount, coords?.City ?? location, occurredAt,
            cancellationToken);

        return Accepted(new SubmitTransactionResponse(transactionId, "Accepted"));
    }
    
    [HttpGet("recent")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<ActionResult<IReadOnlyList<FraudItemResponse>>> GetRecent(
        [FromQuery] int? limit,
        CancellationToken cancellationToken)
    {
        var take = limit is null ? DefaultLimit : Math.Clamp(limit.Value, 1, MaxLimit);
        var items = await _db.Transactions
            .Include(t => t.FraudResult)
            .Include(t => t.TransactionUser)
            .OrderByDescending(t => t.OccurredAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        return Ok(items.Select(ResponseMapper.ToFraudItem).ToList());
    }
}
