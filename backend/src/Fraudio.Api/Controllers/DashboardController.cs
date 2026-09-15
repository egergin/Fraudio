using Fraudio.Api.Errors;
using Fraudio.Api.Models;
using Fraudio.Domain.Enums;
using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin,Analyst")]
public sealed class DashboardController : ControllerBase
{
    private readonly FraudioDbContext _db;

    public DashboardController(FraudioDbContext db)
    {
        _db = db;
    }
    
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> GetSummary(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var scoped = _db.Transactions.AsQueryable();
        if (from.HasValue)
        {
            scoped = scoped.Where(t => t.OccurredAt >= ToUtc(from.Value));
        }

        if (to.HasValue)
        {
            scoped = scoped.Where(t => t.OccurredAt < ToUtc(to.Value));
        }

        var total = await scoped.CountAsync(cancellationToken);
        var suspicious = await scoped
            .CountAsync(t => t.Status == TransactionStatus.Suspicious, cancellationToken);
        var totalUsers = await scoped
            .Select(t => t.TransactionUserId)
            .Distinct()
            .CountAsync(cancellationToken);
        var suspiciousUsers = await scoped
            .Where(t => t.Status == TransactionStatus.Suspicious)
            .Select(t => t.TransactionUserId)
            .Distinct()
            .CountAsync(cancellationToken);
        var totalVolume = await scoped
            .SumAsync(t => (decimal?)t.Amount, cancellationToken) ?? 0m;
        var suspiciousVolume = await scoped
            .Where(t => t.Status == TransactionStatus.Suspicious)
            .SumAsync(t => (decimal?)t.Amount, cancellationToken) ?? 0m;

        return Ok(new DashboardSummaryResponse(
            total, suspicious, totalUsers, suspiciousUsers, totalVolume, suspiciousVolume));
    }
    
    private static DateTime ToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
    
    [HttpGet("series")]
    public async Task<ActionResult<IReadOnlyList<SeriesPointResponse>>> GetSeries(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string granularity = "day",
        [FromQuery] string timeZone = "UTC",
        CancellationToken cancellationToken = default)
    {
        granularity = (granularity ?? "day").ToLowerInvariant();
        if (granularity != "hour" && granularity != "day")
        {
            return BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError, "Granularity must be 'hour' or 'day'."));
        }

        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(timeZone) ? "UTC" : timeZone);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException || ex is InvalidTimeZoneException)
        {
            return BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError, "Unknown time zone."));
        }

        var toUtc = to.HasValue ? ToUtc(to.Value) : DateTime.UtcNow;
        var fromUtc = from.HasValue ? ToUtc(from.Value) : toUtc.AddDays(-7);
        if (fromUtc >= toUtc)
        {
            return BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError, "From must be earlier than to."));
        }

        var step = granularity == "hour" ? TimeSpan.FromHours(1) : TimeSpan.FromDays(1);
        var startWall = FloorZoned(TimeZoneInfo.ConvertTimeFromUtc(fromUtc, tz), step);
        var toWall = TimeZoneInfo.ConvertTimeFromUtc(toUtc, tz);
        var bucketCount = (int)Math.Ceiling((toWall - startWall).TotalMinutes / step.TotalMinutes);
        if (bucketCount > 366)
        {
            return BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError, "Requested range is too large."));
        }

        var rangeStartUtc = TimeZoneInfo.ConvertTimeToUtc(startWall, tz);
        var rows = await _db.Transactions
            .Where(t => t.OccurredAt >= rangeStartUtc && t.OccurredAt < toUtc)
            .Select(t => new { t.OccurredAt, t.Amount, t.Status })
            .ToListAsync(cancellationToken);

        var points = new List<SeriesPointResponse>(bucketCount);
        for (var i = 0; i < bucketCount; i++)
        {
            var wallStart = startWall.AddTicks(step.Ticks * i);
            var bucketStart = TimeZoneInfo.ConvertTimeToUtc(wallStart, tz);
            var bucketEnd = TimeZoneInfo.ConvertTimeToUtc(wallStart.Add(step), tz);
            var inBucket = rows.Where(r => r.OccurredAt >= bucketStart && r.OccurredAt < bucketEnd).ToList();
            points.Add(new SeriesPointResponse(
                bucketStart,
                inBucket.Count,
                inBucket.Count(r => r.Status == TransactionStatus.Suspicious),
                inBucket.Sum(r => r.Amount),
                inBucket.Where(r => r.Status == TransactionStatus.Suspicious).Sum(r => r.Amount)));
        }

        return Ok(points);
    }

    private static DateTime FloorZoned(DateTime wall, TimeSpan step) =>
        step == TimeSpan.FromHours(1)
            ? new DateTime(wall.Year, wall.Month, wall.Day, wall.Hour, 0, 0, DateTimeKind.Unspecified)
            : new DateTime(wall.Year, wall.Month, wall.Day, 0, 0, 0, DateTimeKind.Unspecified);
}
