using Fraudio.Api.Models;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/frauds")]
[Authorize(Roles = "Admin,Analyst")]
public sealed class FraudsController : ControllerBase
{
    private const int RecentLimit = 20;
    private readonly FraudioDbContext _db;

    public FraudsController(FraudioDbContext db)
    {
        _db = db;
    }
    
    [HttpGet("recent")]
    public async Task<ActionResult<IReadOnlyList<FraudItemResponse>>> GetRecent(
        CancellationToken cancellationToken)
    {
        var items = await _db.Transactions
            .Include(t => t.FraudResult)
            .Include(t => t.TransactionUser)
            .Where(t => t.Status == TransactionStatus.Suspicious)
            .OrderByDescending(t => t.OccurredAt)
            .Take(RecentLimit)
            .ToListAsync(cancellationToken);

        return Ok(items.Select(ResponseMapper.ToFraudItem).ToList());
    }
}
