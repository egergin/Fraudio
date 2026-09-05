using Fraudio.Domain;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController, Authorize(Roles = "Admin,Analyst"), Route("api/transaction-users")]
public sealed class TransactionUsersController(FraudioDbContext db) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> Detail(string userId, CancellationToken ct)
    {
        var user = await db.TransactionUsers.Where(x => x.ExternalUserId == userId).Select(x => new { userId = x.ExternalUserId, totalTransactions = x.Transactions.Count, suspiciousTransactions = x.Transactions.Count(t => t.Status == TransactionStatus.Suspicious), lastTransaction = x.Transactions.OrderByDescending(t => t.OccurredAt).Select(t => new { t.Id, t.Amount, t.City, t.Status, t.OccurredAt }).FirstOrDefault() }).SingleOrDefaultAsync(ct);
        return user is null ? NotFound(new { code = "USER_NOT_FOUND", message = "Kullanıcı kaydı bulunamadı." }) : Ok(user);
    }

    [HttpGet("{userId}/transactions")]
    public async Task<IActionResult> History(string userId, CancellationToken ct)
    {
        var items = await db.Transactions
            .Include(x => x.FraudResult)
            .Where(x => x.TransactionUser!.ExternalUserId == userId)
            .OrderByDescending(x => x.OccurredAt)
            .Take(20)
            .ToListAsync(ct);

        var result = items.Select(x => new
        {
            transactionId = x.Id,
            x.Amount,
            x.City,
            x.Country,
            status = x.Status.ToString(),
            x.OccurredAt,
            triggeredRules = x.FraudResult == null
                ? Array.Empty<string>()
                : new[]
                {
                    x.FraudResult.VelocityTriggered ? "Velocity" : null,
                    x.FraudResult.AmountTriggered ? "Amount" : null,
                    x.FraudResult.LocationTriggered ? "Location" : null
                }.Where(r => r != null).ToArray()
        });

        return Ok(result);
    }
}

[ApiController, Authorize(Roles = "Admin,Analyst"), Route("api/frauds")]
public sealed class FraudsController(FraudioDbContext db) : ControllerBase
{
    [HttpGet("recent")]
    public async Task<IActionResult> Recent(CancellationToken ct)
    {
        var items = await db.Transactions
            .Include(x => x.TransactionUser)
            .Include(x => x.FraudResult)
            .Where(x => x.Status == TransactionStatus.Suspicious)
            .OrderByDescending(x => x.OccurredAt)
            .Take(20)
            .ToListAsync(ct);

        var result = items.Select(x => new
        {
            transactionId = x.Id,
            userId = x.TransactionUser?.ExternalUserId ?? "Bilinmiyor",
            x.Amount,
            x.City,
            status = x.Status.ToString(),
            x.OccurredAt,
            triggeredRules = x.FraudResult == null
                ? Array.Empty<string>()
                : new[]
                {
                    x.FraudResult.VelocityTriggered ? "Velocity" : null,
                    x.FraudResult.AmountTriggered ? "Amount" : null,
                    x.FraudResult.LocationTriggered ? "Location" : null
                }.Where(r => r != null).ToArray()
        });

        return Ok(result);
    }
}

[ApiController, Authorize(Roles = "Admin"), Route("api/admin")]
public sealed class AdminController(FraudioDbContext db) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken ct) => Ok(await db.ApplicationUsers.OrderBy(x => x.Username).Select(x => new { x.Id, x.Username, x.Email, x.Role, x.CreatedAt }).ToListAsync(ct));
}
