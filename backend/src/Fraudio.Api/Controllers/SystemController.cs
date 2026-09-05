using Fraudio.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using StackExchange.Redis;

namespace Fraudio.Api.Controllers;

[ApiController, Authorize(Roles = "Admin"), Route("api/system")]
public sealed class SystemController(FraudioDbContext db, IConnectionMultiplexer redis, IConnection rabbit) : ControllerBase
{
    [HttpGet("health")]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        var postgres = await db.Database.CanConnectAsync(ct);
        var redisOk = await redis.GetDatabase().PingAsync() >= TimeSpan.Zero;
        var rabbitOk = rabbit.IsOpen;
        var result = new { postgreSql = postgres ? "Healthy" : "Unhealthy", redis = redisOk ? "Healthy" : "Unhealthy", rabbitMq = rabbitOk ? "Healthy" : "Unhealthy" };
        return postgres && redisOk && rabbitOk ? Ok(result) : StatusCode(503, result);
    }
}
