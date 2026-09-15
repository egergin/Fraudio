using Fraudio.Api.Errors;
using Fraudio.Api.Models;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/transaction-users")]
[Authorize(Roles = "Admin,Analyst")]
public sealed class TransactionUsersController : ControllerBase
{
    private const int HistoryLimit = 20;
    private readonly FraudioDbContext _db;

    public TransactionUsersController(FraudioDbContext db)
    {
        _db = db;
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<TransactionUserDetailResponse>> GetUser(
        [FromRoute] string userId,
        CancellationToken cancellationToken)
    {
        var user = await _db.TransactionUsers
            .FirstOrDefaultAsync(u => u.ExternalUserId == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new ErrorResponse(ErrorCodes.UserNotFound, "Transaction user not found."));
        }

        var total = await _db.Transactions
            .CountAsync(t => t.TransactionUserId == user.Id, cancellationToken);
        var suspicious = await _db.Transactions
            .CountAsync(
                t => t.TransactionUserId == user.Id && t.Status == TransactionStatus.Suspicious,
                cancellationToken);
        var last = await _db.Transactions
            .Include(t => t.FraudResult)
            .Where(t => t.TransactionUserId == user.Id)
            .OrderByDescending(t => t.OccurredAt)
            .FirstOrDefaultAsync(cancellationToken);

        return Ok(new TransactionUserDetailResponse(
            user.ExternalUserId,
            total,
            suspicious,
            last is null ? null : ResponseMapper.ToItem(last)));
    }

    [HttpGet("{userId}/transactions")]
    public async Task<ActionResult<IReadOnlyList<TransactionItemResponse>>> GetHistory(
        [FromRoute] string userId,
        CancellationToken cancellationToken)
    {
        var exists = await _db.TransactionUsers
            .AnyAsync(u => u.ExternalUserId == userId, cancellationToken);

        if (!exists)
        {
            return NotFound(new ErrorResponse(ErrorCodes.UserNotFound, "Transaction user not found."));
        }

        var items = await _db.Transactions
            .Include(t => t.FraudResult)
            .Where(t => t.TransactionUser.ExternalUserId == userId)
            .OrderByDescending(t => t.OccurredAt)
            .Take(HistoryLimit)
            .ToListAsync(cancellationToken);

        return Ok(items.Select(ResponseMapper.ToItem).ToList());
    }
}
